export type UserRole = 'ADMIN';
export interface UserDTO {
    id: string;
    email: string;
    role: UserRole;
    createdAt: string;
    updatedAt: string;
}
export interface AuthTokens {
    accessToken: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse extends AuthTokens {
    user: UserDTO;
}
