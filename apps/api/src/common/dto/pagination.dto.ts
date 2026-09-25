import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Pagination systématique des listes (chapitre 9 : page/limit ; ch. 8 : sobriété, moins de
 * données transférées).
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface Page<T> {
  donnees: T[];
  total: number;
  page: number;
  limit: number;
}

export class MetaPageDto {
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export function clausePagination(q: PaginationQueryDto): { skip: number; take: number } {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}

export function construirePage<T>(donnees: T[], total: number, q: PaginationQueryDto): Page<T> {
  return { donnees, total, page: q.page, limit: q.limit };
}
