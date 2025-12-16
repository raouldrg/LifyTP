export type AuthToken = {
  token: string
  userId: string
  issuedAt: number
}

export type User = {
  id: string
  email: string
  displayName: string
}
