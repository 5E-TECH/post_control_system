import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// Telegram bitta xabar chegarasi 4096 belgi.
export class BroadcastDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
