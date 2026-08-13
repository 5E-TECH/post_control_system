import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// AI savol uzunligi chegarasi — Claude'ga cheksiz matn ketmasin (xarajat/DoS).
const QUESTION_MAX = 2000;

export class AiAskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(QUESTION_MAX)
  question: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate YYYY-MM-DD bo\'lishi kerak' })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate YYYY-MM-DD bo\'lishi kerak' })
  toDate?: string;
}
