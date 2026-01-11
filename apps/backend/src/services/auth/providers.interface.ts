export interface HubUserInfo {
  email: string;
  id: string;
  hubClientId?: string;
  hubRole?: string;
}

export interface ProvidersInterface {
  generateLink(query?: any): Promise<string> | string;
  getToken(code: string): Promise<string>;
  getUser(providerToken: string, hubClientId?: string): Promise<HubUserInfo> | false;
}
