import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
// Reusable pagination query parameters. Every list endpoint accepts `page` + `pageSize` and returns a…
// `Paginated<T>` envelope.
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
