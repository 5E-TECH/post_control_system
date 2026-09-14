import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import { ElchiShipmentEntity } from 'src/core/entity/elchi-shipment.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { Order_status, Status, Where_deliver } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ElchiApiService } from './elchi-api.service';
import { ElchiConfigService } from './elchi-config.service';

/** Bu provayderning slug'i — `order.control_owner` va `users.external_provider`da. */
export const ELCHI_PROVIDER = 'elchi';

/**
 * Yakunlangan buyurtma Elchi'ga JO'NATILMAYDI — aks holda darhol nomuvofiqlik
 * tug'iladi (Elchi yetkazishga urinadi, bizda esa allaqachon yopilgan).
 */
const ELCHI_SKIP_ORDER_STATUSES: Order_status[] = [
  Order_status.SOLD,
  Order_status.PAID,
  Order_status.PARTLY_PAID,
  Order_status.CANCELLED,
  Order_status.CANCELLED_SENT,
  Order_status.CLOSED,
];

@Injectable()
export class ElchiShipmentService {
  private readonly logger = new Logger(ElchiShipmentService.name);

  constructor(
    @InjectRepository(ElchiConfigEntity)
    private readonly configRepo: Repository<ElchiConfigEntity>,
    @InjectRepository(ElchiShipmentEntity)
    private readonly shipmentRepo: Repository<ElchiShipmentEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly api: ElchiApiService,
    private readonly configService: ElchiConfigService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ===================== KILL SWITCH =====================

  /**
   * Elchi'ga jo'natishning YAGONA to'sig'i. Barcha dispatch yo'llari shu
   * metoddan o'tadi (pochta jo'natish, qo'lda qayta jo'natish, auto-retry) —
   * shuning uchun o'chirish "toza" bo'ladi: posilka yozuvi ham yaratilmaydi.
   *
   * Ierarxiya: sozlama bormi → master kalit yoqilganmi → virtual kuryer
   * bloklanmaganmi.
   */
  async assertElchiDispatchEnabled(): Promise<ElchiConfigEntity> {
    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!config) {
      throw new ServiceUnavailableException(
        "Elchi sozlamalari topilmadi — avval sozlamalarni kiriting",
      );
    }
    if (!config.is_active) {
      throw new ServiceUnavailableException(
        "Elchi integratsiyasi o'chirilgan",
      );
    }

    // Virtual kuryer bloklangan bo'lsa dispatch ham to'xtaydi — operator uchun
    // bu "tez tormoz": kuryerni bloklash butun oqimni to'xtatadi.
    if (config.elchi_courier_user_id) {
      const courier = await this.userRepo.findOne({
        where: { id: config.elchi_courier_user_id },
        select: ['id', 'status'],
      });
      if (!courier || courier.status !== Status.ACTIVE) {
        throw new ServiceUnavailableException(
          "Elchi vakil-kuryeri bloklangan — jo'natish to'xtatildi",
        );
      }
    }

    if (!config.elchi_market_id) {
      throw new ServiceUnavailableException(
        "Elchi market akkaunti sozlanmagan (elchi_market_id)",
      );
    }

    return config;
  }

  // ===================== DARVOZA =====================

  /**
   * HUDUD DARVOZASI — pochta jo'natilishidan OLDIN chaqiriladi.
   *
   * QOIDA: hammasi yoki hech biri. Pochtada bitta ruxsatsiz tuman bo'lsa BUTUN
   * pochta bloklanadi.
   *
   * NEGA QISMAN JO'NATISH YO'Q. Agar bir qismini o'tkazib yuborsak, qolganlari
   * `ON_THE_ROAD` holatida "yetim" bo'lib qoladi: pochtada turadi, lekin hech
   * qaysi tizim ularni yetkazmaydi. Tuman bo'yicha avtomatik routing 2026-06-04
   * da aynan SHU muammo tufayli olib tashlangan — takrorlamaymiz.
   *
   * Bu ROUTER emas, DARVOZA: tizim buyurtmani tumaniga qarab o'zi
   * yo'naltirmaydi, operator baribir qo'lda "Elchi" kuryerini tanlaydi. Darvoza
   * faqat ruxsatsiz tumanni BLOKLAYDI (ochiq xato bilan).
   */
  async assertDistrictsAllowedForPost(
    orders: Array<{
      id: string;
      order_number?: number | null;
      district_id?: string | null;
      district?: { name?: string } | null;
    }>,
  ): Promise<void> {
    const blocked = await this.findBlockedByGate(orders);

    if (blocked.length) {
      const labels = blocked.map(
        (item) => `${item.label} (${item.district_name})`,
      );
      throw new BadRequestException(
        `Elchi'ga jo'natish bloklandi — quyidagi buyurtmalarning tumani ` +
          `ruxsat ro'yxatida yo'q: ${labels.join(', ')}. ` +
          `Tumanlarni Elchi sozlamalarida yoqing yoki bu buyurtmalarni ` +
          `pochtadan chiqaring.`,
      );
    }
  }

  /**
   * Darvoza tekshiruvining O'ZAGI — ruxsat etilmagan buyurtmalar ro'yxati.
   *
   * `assertDistrictsAllowedForPost` (xato tashlaydi) va UI'ning OLDINDAN
   * tekshiruvi (`previewGate`, xato tashlamaydi) AYNI shu metodni ishlatadi —
   * ikki yo'l ajralib ketmasligi uchun. Aks holda UI "hammasi joyida" deb
   * ko'rsatib, jo'natishda xato chiqishi mumkin edi.
   */
  private async findBlockedByGate(
    orders: Array<{
      id: string;
      order_number?: number | null;
      district_id?: string | null;
      district?: { name?: string } | null;
    }>,
  ): Promise<
    Array<{ order_id: string; label: string; district_name: string }>
  > {
    const blocked: Array<{
      order_id: string;
      label: string;
      district_name: string;
    }> = [];

    for (const order of orders) {
      const districtId = String(order.district_id ?? '').trim();
      const allowed = districtId
        ? await this.configService.isDistrictAllowed(districtId)
        : false;
      if (!allowed) {
        blocked.push({
          order_id: order.id,
          label: order.order_number ? `#${order.order_number}` : order.id,
          district_name: order.district?.name ?? 'tuman belgilanmagan',
        });
      }
    }

    return blocked;
  }

  /**
   * UI uchun OLDINDAN tekshiruv — jo'natish tugmasini bosishdan OLDIN.
   *
   * Nega kerak: darvoza xatosi jo'natish paytida chiqsa, operator allaqachon
   * tugmani bosgan bo'ladi va "nega ishlamadi" deb qoladi. Oldindan ko'rsatilsa
   * u muammoli buyurtmani pochtadan chiqarib, keyin jo'natadi.
   *
   * Xato TASHLAMAYDI — bu faqat ma'lumot.
   */
  async previewGate(orderIds: string[]): Promise<{
    total: number;
    allowed: number;
    blocked: Array<{ order_id: string; label: string; district_name: string }>;
  }> {
    const ids = Array.from(new Set((orderIds ?? []).filter(Boolean)));
    if (!ids.length) {
      return { total: 0, allowed: 0, blocked: [] };
    }

    const orders = await this.orderRepo.find({
      where: { id: In(ids) },
      select: ['id', 'order_number', 'district_id'],
      relations: ['district'],
    });

    const blocked = await this.findBlockedByGate(orders);
    return {
      total: orders.length,
      allowed: orders.length - blocked.length,
      blocked,
    };
  }

  /**
   * Pochta bo'yicha jo'natish holati — UI "12/12 Elchi'ga yetdi" chizig'i uchun.
   *
   * Nega kerak: dispatch fire-and-forget ishlaydi (pochta jo'natish
   * tranzaksiyasini bloklamaslik uchun). Ya'ni operator "jo'natildi" degan
   * xabarni ko'radi-yu, Elchi'ga haqiqatan yetgan-yetmaganini BILMAYDI.
   * Bu endpoint jimgina yo'qolgan buyurtmani ko'rsatadi.
   */
  async getDispatchStatusForPost(postId: string): Promise<{
    total: number;
    delivered: number;
    failed: number;
    items: Array<{
      order_id: string;
      elchi_shipment_id: string | null;
      last_error: string | null;
      send_attempts: number;
    }>;
  }> {
    const rows = await this.shipmentRepo.find({
      where: { post_id: postId },
      select: [
        'order_id',
        'elchi_shipment_id',
        'last_error',
        'send_attempts',
      ],
    });

    const items = rows.map((row) => ({
      order_id: row.order_id,
      elchi_shipment_id: row.elchi_shipment_id,
      last_error: row.last_error,
      send_attempts: row.send_attempts ?? 0,
    }));

    return {
      total: items.length,
      delivered: items.filter((item) => !!item.elchi_shipment_id).length,
      failed: items.filter((item) => !item.elchi_shipment_id).length,
      items,
    };
  }

  // ===================== JO'NATISH =====================

  /**
   * Buyurtmani Elchi'ga posilka sifatida uzatadi.
   *
   * Idempotentlik ikki qatlamli:
   *   1. Bizda — ayni post uchun allaqachon yuborilgan bo'lsa qaytaramiz;
   *   2. Elchi'da — `external_order_id` (bizning UUID) bo'yicha takroriy
   *      chaqiruv yangi posilka ochmaydi, mavjudini qaytaradi.
   *
   * Muvaffaqiyatda `order.control_owner = 'elchi'` qo'yiladi — shundan keyin
   * BeePost UI'dan sotish/bekor BLOKLANADI (pul ikki daftarda paydo
   * bo'lishining oldini oladi).
   */
  async createShipmentForOrder(
    orderId: string,
    actor?: JwtPayload,
  ): Promise<ElchiShipmentEntity> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer', 'district'],
    });
    if (!order) {
      throw new NotFoundException(`Order topilmadi: ${orderId}`);
    }

    let shipment = await this.shipmentRepo.findOne({
      where: { order_id: orderId },
    });

    // Ayni urinish (post) uchun allaqachon yuborilgan — idempotent.
    if (
      shipment?.elchi_shipment_id &&
      shipment.post_id &&
      order.post_id &&
      shipment.post_id === order.post_id
    ) {
      return shipment;
    }

    // ===== KILL SWITCH =====
    const config = await this.assertElchiDispatchEnabled();

    // Yakunlangan buyurtma jo'natilmaydi (nomuvofiqlik oldini olish).
    if (ELCHI_SKIP_ORDER_STATUSES.includes(order.status)) {
      if (shipment) return shipment;
      throw new BadRequestException(
        `Buyurtma yakunlangan (status=${order.status}) — Elchi'ga jo'natilmaydi`,
      );
    }

    // ===== DARVOZA (bitta buyurtma uchun) =====
    // Pochta darajasidagi tekshiruv `assertDistrictsAllowedForPost`da, lekin bu
    // metod boshqa yo'llardan ham chaqiriladi (qo'lda qayta jo'natish, retry) —
    // shuning uchun darvoza YANA tekshiriladi. Ikki qatlam ataylab.
    const geo = await this.configService.resolveElchiGeo(
      String(order.district_id ?? ''),
    );
    if (!geo) {
      throw new BadRequestException(
        `Buyurtma tumani Elchi'ga jo'natishga ruxsat etilmagan ` +
          `(${order.district?.name ?? order.district_id})`,
      );
    }

    if (!order.customer?.name || !order.customer?.phone_number) {
      throw new BadRequestException(
        "Mijoz ismi yoki telefoni yo'q — Elchi posilka yaratolmaydi",
      );
    }

    if (!shipment) {
      shipment = this.shipmentRepo.create({ order_id: orderId });
    }

    // Qayta jo'natish — eski Elchi ma'lumotini tozalaymiz, aks holda jo'natish
    // muvaffaqiyatsiz bo'lsa eskirgan `elchi_shipment_id` qolib, solishtiruvchi
    // uni noto'g'ri ishlatishi mumkin.
    shipment.post_id = order.post_id ?? null;
    shipment.elchi_shipment_id = null;
    shipment.qr_code_token = null;
    shipment.elchi_status = null;
    shipment.elchi_status_changed_at = null;

    /**
     * ⚠️ MIJOZ TO'LAYDIGAN SUMMA = `total_price`, `to_be_paid` EMAS.
     *
     * PCS'da `order.to_be_paid` nomi chalg'ituvchi: u mijozning qarzi EMAS,
     * balki SOTUVDAN KEYIN "biz MARKETGA qancha qarzdormiz" degani
     * (`total_price − marketTarif`, `order.service.ts` sotuv bloki). Buyurtma
     * yaratilganda esa u DB default'i bilan **0** bo'lib turadi.
     *
     * Ya'ni `to_be_paid` yuborilsa Elchi'ga har doim `cod_amount = 0` ketardi
     * va Elchi buyurtmani OLDINDAN TO'LANGAN deb hisoblab, kuryer mijozdan
     * HECH NARSA UNDIRMASDI. Kuryer aslida `total_price` yig'adi — buni sotuv
     * matematikasi ham tasdiqlaydi (`price = order.total_price`, kuryer
     * `price − courierTarif` ni topshiradi).
     */
    const cod = Number(order.total_price ?? 0);

    try {
      const response = await this.api.createShipment({
        external_order_id: order.id,
        elchi_market_id: String(config.elchi_market_id),
        customer: {
          name: order.customer.name,
          phone: order.customer.phone_number,
        },
        address: order.address ?? null,
        region_id: geo.elchi_region_id,
        district_id: geo.elchi_district_id,
        where_deliver:
          order.where_deliver === Where_deliver.CENTER ? 'center' : 'address',
        /**
         * `external_product_id` — PCS mahsulot UUID'i.
         *
         * Elchi shu id bo'yicha o'z katalogida mahsulotni topadi; yo'q bo'lsa
         * AVTOMATIK yaratadi, bor bo'lsa qayta ishlatadi. Shu sabab bir xil
         * mahsulot Elchi'da bir marta yaratiladi va uning hisobotlarida
         * to'g'ri guruhlanadi.
         *
         * Id NOM bilan birga yuboriladi, lekin bog'lanish IDga tayanadi: nom
         * o'zgarsa (imlo tuzatildi, brend qo'shildi) Elchi tomonida YANGI
         * mahsulot paydo bo'lmasligi kerak.
         */
        items: (order.items ?? [])
          .map((item) => ({
            name: String(item.product?.name ?? '').trim(),
            quantity: Number(item.quantity ?? 1),
            external_product_id: item.product?.id
              ? String(item.product.id)
              : undefined,
          }))
          .filter((item) => item.name.length > 0 && item.quantity > 0),
        cod_amount: cod,
        // ⚠️ M3: `subtotal` ATAYLAB `cod_amount` bilan TENG yuboriladi.
        // Elchi'ning sotuv matematikasi `to_be_paid`ni O'QIMAYDI — u
        // `total_price` ustida ishlaydi. Ikki maydon farq qilsa, pul hisobi biz
        // kutgandan boshqacha chiqadi (oldindan to'langan buyurtmada esa
        // umuman xato bo'ladi).
        subtotal: cod,
      });

      const remoteId = String(response?.shipment_id ?? '').trim();
      if (!remoteId) {
        // Elchi javob berdi-yu, id chiqmadi — bu javob shakli nomuvofiqligi.
        // Jimgina null saqlab keyin dublikat yaratmaslik uchun aniq xato.
        // Takroriy urinish xavfsiz: Elchi `external_order_id` bo'yicha
        // idempotent.
        throw new Error(
          `Elchi javobida shipment_id topilmadi: ${JSON.stringify(
            response,
          ).slice(0, 300)}`,
        );
      }

      shipment.elchi_shipment_id = remoteId;
      shipment.qr_code_token = response?.qr_code_token ?? null;
      shipment.elchi_status = response?.order_status ?? null;
      shipment.cod_amount_sent = cod.toFixed(2);
      shipment.last_request_id = order.id;
      shipment.last_error = null;
      shipment.send_attempts = (shipment.send_attempts ?? 0) + 1;
      await this.shipmentRepo.save(shipment);

      // BOSHQARUV EGASI — shundan keyin BeePostda sotish/bekor bloklanadi.
      await this.orderRepo.update(
        { id: order.id },
        { control_owner: ELCHI_PROVIDER },
      );

      this.logger.log(
        `Elchi posilka yaratildi: order=${order.id} post=${order.post_id} ` +
          `shipment_id=${remoteId} idempotent=${!!response?.idempotent}`,
      );

      await this.activityLog.log({
        entity_type: 'order',
        entity_id: order.id,
        action: 'elchi_dispatched',
        new_value: {
          elchi_shipment_id: remoteId,
          cod_amount: cod,
          control_owner: ELCHI_PROVIDER,
        },
        description: `Buyurtma #${order.order_number ?? order.id} Elchi'ga jo'natildi`,
        user: actor,
      });

      return shipment;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      shipment.last_error = msg.slice(0, 1000);
      shipment.send_attempts = (shipment.send_attempts ?? 0) + 1;
      await this.shipmentRepo.save(shipment);
      this.logger.warn(`Elchi'ga jo'natish xatosi (order=${orderId}): ${msg}`);
      throw error;
    }
  }

  // ===================== BOSHQARUVNI QAYTARIB OLISH =====================

  /**
   * ZAXIRA YO'LI — buyurtma boshqaruvini Elchi'dan qaytarib olish.
   *
   * Qachon kerak: integratsiya buzildi, Elchi posilkani qaytardi, yoki
   * operator buyurtmani BeePostda o'zi yakunlashi kerak.
   *
   * TARTIB MUHIM: avval Elchi tomonidagi posilka BEKOR qilinadi, keyin
   * `control_owner` bo'shatiladi. Aks holda ikki tomon bir vaqtda faol bo'lib
   * qoladi — ya'ni aynan biz oldini olmoqchi bo'lgan holat.
   *
   * Elchi posilkani bekor qila olmasa (masalan allaqachon sotilgan — 409),
   * boshqaruv QAYTARILMAYDI: bu holatda haqiqiy nomuvofiqlik bor va uni
   * jimgina bosib o'tish pul xatosiga olib keladi. Operator webhookni kutishi
   * yoki holatni qo'lda tekshirishi kerak.
   */
  async reclaimControl(
    orderId: string,
    actor?: JwtPayload,
    options?: { force?: boolean },
  ): Promise<{ reclaimed: boolean; elchi_cancelled: boolean; note?: string }> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      select: ['id', 'order_number', 'control_owner'],
    });
    if (!order) {
      throw new NotFoundException(`Order topilmadi: ${orderId}`);
    }
    if (!order.control_owner) {
      return {
        reclaimed: true,
        elchi_cancelled: false,
        note: 'Buyurtma allaqachon BeePost nazoratida',
      };
    }

    const shipment = await this.shipmentRepo.findOne({
      where: { order_id: orderId },
    });

    let elchiCancelled = false;
    let note: string | undefined;

    if (shipment?.elchi_shipment_id) {
      try {
        await this.api.cancelShipment(shipment.elchi_shipment_id);
        elchiCancelled = true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        note = `Elchi posilkasini bekor qilib bo'lmadi: ${msg}`;

        // `force` — operator ATAYLAB boshqaruvni tortib oladi (masalan Elchi
        // API butunlay ishlamayapti). Bu holatda ikki tomon vaqtincha faol
        // bo'lib qolishi MUMKIN, shu bois nomuvofiqlik belgisi qo'yiladi.
        if (!options?.force) {
          throw new BadRequestException(
            `${note}. Elchi tomonida posilka hali faol — boshqaruv ` +
              `qaytarilmadi. Zarur bo'lsa "majburiy qaytarib olish" ` +
              `amalidan foydalaning.`,
          );
        }

        shipment.mismatch_at = Date.now();
        shipment.mismatch_reason = `Majburiy qaytarib olish: ${note}`;
        await this.shipmentRepo.save(shipment);
      }
    }

    await this.orderRepo.update({ id: orderId }, { control_owner: null });

    await this.activityLog.log({
      entity_type: 'order',
      entity_id: orderId,
      action: 'elchi_control_reclaimed',
      old_value: { control_owner: order.control_owner },
      new_value: {
        control_owner: null,
        elchi_cancelled: elchiCancelled,
        forced: !!options?.force,
      },
      description: `Buyurtma #${order.order_number ?? orderId} boshqaruvi Elchi'dan qaytarib olindi`,
      user: actor,
    });

    return { reclaimed: true, elchi_cancelled: elchiCancelled, note };
  }
}
