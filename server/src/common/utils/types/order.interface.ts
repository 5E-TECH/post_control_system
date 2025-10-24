export interface PrintOrder {
  orderId: string;
  orderPrice: string;
  customerName: string;
  customerPhone: string;
  market: string;
  comment: string;
  district: string;
  address: string;
  qrCode: string;
  created_time: string;
  items: {
    product: string;
    quantity: number;
  }[];
}
