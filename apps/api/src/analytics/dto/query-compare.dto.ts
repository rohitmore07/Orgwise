import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Query payload for the department comparison — a comma-separated id list. */
export class QueryCompareDto {
  @ApiProperty({
    example: 'clx1abc,clx2def,clx3ghi',
    description: 'Comma-separated department ids to compare (scope-aware)',
  })
  @IsString()
  @IsNotEmpty()
  departmentIds!: string;
}
