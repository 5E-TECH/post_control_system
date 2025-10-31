export interface PrintOrder {
  orderId: string;
  orderPrice: string;
  operator: string;
  customerName: string;
  customerPhone: string;
  extraNumber: string;
  market: string;
  comment: string;
  region: string;
  district: string;
  address: string;
  qrCode: string;
  created_time: string;
  whereDeliver: string;
  items: {
    product: string;
    quantity: number;
  }[];
}
