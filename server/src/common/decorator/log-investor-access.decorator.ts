import { SetMetadata } from '@nestjs/common';

// Investor endpointiga har bir kirishni activity-log'ga yozish uchun handler'ga
// qo'yiladigan metadata. Qiymati — log'da ko'rinadigan amal nomi (masalan 'overview').
export const LOG_INVESTOR_ACTION = 'log_investor_action';

export const LogInvestorAccess = (action: string) =>
  SetMetadata(LOG_INVESTOR_ACTION, action);
