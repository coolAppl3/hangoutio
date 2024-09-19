interface SqlError {
  code?: string,
  errno?: number,
  sql?: string,
  sqlState?: string,
  sqlMessage?: string,
}