import { memo } from 'react';
import { House, ShoppingBag, MailOpen, CreditCard, Zap, MapPinned, Receipt } from 'lucide-react';
import SidebarLink from './SidebarLink';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { useExtraCost } from '../../shared/api/hooks/useExtraCost';

const CourierSidebar = () => {
  const { t } = useTranslation(['sidebar']);

  // Ikki xil ish bitta raqamda: isbot biriktirish KERAK bo'lganlar +
  // ko'rilmagan qarorlar. Ikkisi ham aynan shu sahifada hal bo'ladi.
  const { getCourierCounts } = useExtraCost();
  const { data: extraCostCounts } = getCourierCounts();
  const extraCostBadge =
    Number(extraCostCounts?.awaiting_proof ?? 0) +
    Number(extraCostCounts?.unseen ?? 0);

  const links = [
    { to: '/', icon: <House />, label: t('dashboard'), end: true },
    {
      to: '/courier-orders/orders',
      icon: <ShoppingBag />,
      label: t('orders'),
    },
    { to: '/courier-bulk', icon: <Zap />, label: t('courier_bulk') },
    { to: '/courier-mails', icon: <MailOpen />, label: t('mails') },
    { to: '/cash-box', icon: <CreditCard />, label: t('payments') },
    {
      to: '/my-extra-cost',
      icon: <Receipt />,
      label: "Qo'shimcha xarajat",
      badge: extraCostBadge,
    },
    { to: '/my-region', icon: <MapPinned />, label: t('myRegion') },
  ];
    const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  return (
    <div className="bg-[var(--color-bg-py)] pt-6 dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] h-full">
      <ul className={`flex flex-col gap-1.5 mr-4 ${!sidebarRedux.isOpen ? "w-[60px] transition-all duration-300 ease-in-out" : "w-61"}`}>
        {links.map((link, i) => (
          <li key={i}>
            <SidebarLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default memo(CourierSidebar);
