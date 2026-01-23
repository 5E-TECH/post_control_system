import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

// Error response type
interface ApiErrorResponse {
  message?: string;
  error?: string;
}
import { ExternalIntegrationService } from '../external-integration/external-integration.service';
import { ExternalIntegrationEntity } from 'src/core/entity/external-integration.entity';

@Injectable()
export class ExternalProxyService {
  constructor(
    private readonly httpService: HttpService,
    private readonly integrationService: ExternalIntegrationService,
  ) {}

  /**
   * Slug bo'yicha integratsiyani olish
   */
  private async getIntegration(slug: string): Promise<ExternalIntegrationEntity> {
    const result = await this.integrationService.findBySlug(slug);

    if (!result?.data) {
      throw new NotFoundException(`Integratsiya topilmadi: ${slug}`);
    }

    if (!result.data.is_active) {
      throw new HttpException(
        `Integratsiya faol emas: ${slug}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  /**
   * Dinamik integratsiya orqali QR kod bilan buyurtma qidirish
   */
  async findByQr(slug: string, qrCode: string): Promise<any> {
    try {
      // Integratsiyani olish
      const integration = await this.getIntegration(slug);

      // Token olish
      const token = await this.integrationService.getValidToken(integration);

      if (!token) {
        throw new HttpException(
          'Token olishda xatolik',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // api_url to'g'ridan-to'g'ri ishlatiladi (masalan: https://api.adosh.uz)
      // /qrorder/find qo'shiladi
      let searchUrl: string;
      const apiUrl = integration.api_url.replace(/\/+$/, ''); // Oxirgi / ni olib tashlash

      // Agar api_url da /qrorder/find mavjud bo'lsa, qayta qo'shmaslik
      if (apiUrl.includes('/qrorder/find')) {
        searchUrl = apiUrl;
      } else {
        searchUrl = `${apiUrl}/qrorder/find`;
      }

      console.log('🔍 QR Search URL:', searchUrl);
      console.log('🔍 QR Code:', qrCode);
      console.log('🔍 Token preview:', token.substring(0, 30) + '...');

      // So'rov yuborish
      const response = await firstValueFrom(
        this.httpService.post(
          searchUrl,
          { qr_code: qrCode },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            timeout: 15000,
          },
        ),
      );

      return response.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const axiosError = error as AxiosError;

      // Token expired - yangi token bilan qayta urinish
      if (axiosError.response?.status === 401) {
        try {
          const integration = await this.getIntegration(slug);

          // Majburiy yangi token olish
          const newToken = await this.integrationService.refreshToken(integration);

          if (!newToken) {
            throw new HttpException('Yangi token olib bo\'lmadi', HttpStatus.UNAUTHORIZED);
          }

          const apiUrl = integration.api_url.replace(/\/+$/, '');
          const searchUrl = apiUrl.includes('/qrorder/find') ? apiUrl : `${apiUrl}/qrorder/find`;

          const retryResponse = await firstValueFrom(
            this.httpService.post(
              searchUrl,
              { qr_code: qrCode },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${newToken}`,
                },
                timeout: 15000,
              },
            ),
          );

          return retryResponse.data;
        } catch (retryError) {
          throw new HttpException(
            `Qayta urinishda xatolik: ${(retryError as Error).message}`,
            HttpStatus.BAD_GATEWAY,
          );
        }
      }

      const errorData = axiosError.response?.data as ApiErrorResponse;
      throw new HttpException(
        `API xatoligi: ${errorData?.message || axiosError.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Dinamik integratsiya orqali login qilish (test uchun)
   */
  async login(slug: string): Promise<any> {
    try {
      const integration = await this.getIntegration(slug);
      const token = await this.integrationService.getValidToken(integration);

      return {
        success: true,
        message: 'Login muvaffaqiyatli',
        token_preview: token ? `${token.substring(0, 20)}...` : null,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Login xatoligi: ${(error as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
