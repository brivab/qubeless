export interface LdapConfig {
  enabled: boolean;
  url: string; // ldap://ldap.example.com:389
  bindDn: string; // cn=admin,dc=example,dc=com
  bindPassword: string;
  baseDn: string; // dc=example,dc=com
  searchFilter: string; // (uid={{username}})
  groupBaseDn?: string;
  groupSearchFilter?: string;
  userAttributes: {
    username: string; // uid
    email: string; // mail
    displayName: string; // cn
  };
}

export interface LdapUser {
  username: string;
  email: string;
  displayName: string;
}
