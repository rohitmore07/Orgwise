import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Hard ceiling for one chat message — the service applies the configurable `AI_MAX_INPUT_CHARS` on top. */
const HARD_MAX_MESSAGE_CHARS = 10_000;

export class CopilotChatDto {
  @ApiProperty({
    example: 'Which department has the highest attrition?',
    description: 'User question',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(HARD_MAX_MESSAGE_CHARS)
  message!: string;

  @ApiPropertyOptional({ description: 'Existing conversation id to continue (omit to start new)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;
}
