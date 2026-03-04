// Type declarations for Express
declare module 'express' {
  export interface Request {
    user?: {
      id: string;
      name: string;
    };
  }
}
