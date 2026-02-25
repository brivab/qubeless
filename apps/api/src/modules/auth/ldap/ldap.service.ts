import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ldap from 'ldapjs';
import { LdapConfig, LdapUser } from './ldap.config';

@Injectable()
export class LdapService implements OnModuleDestroy {
  private readonly logger = new Logger(LdapService.name);
  private client: ldap.Client | null = null;
  private config: LdapConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.buildConfig();
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.unbind();
      this.client.destroy();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private buildConfig(): LdapConfig {
    return {
      enabled: this.configService.get<string>('LDAP_ENABLED') === 'true',
      url: this.configService.get<string>('LDAP_URL') || '',
      bindDn: this.configService.get<string>('LDAP_BIND_DN') || '',
      bindPassword: this.configService.get<string>('LDAP_BIND_PASSWORD') || '',
      baseDn: this.configService.get<string>('LDAP_BASE_DN') || '',
      searchFilter: this.configService.get<string>('LDAP_SEARCH_FILTER') || '(uid={{username}})',
      groupBaseDn: this.configService.get<string>('LDAP_GROUP_BASE_DN'),
      groupSearchFilter: this.configService.get<string>('LDAP_GROUP_SEARCH_FILTER'),
      userAttributes: {
        username: this.configService.get<string>('LDAP_USER_ATTR_USERNAME') || 'uid',
        email: this.configService.get<string>('LDAP_USER_ATTR_EMAIL') || 'mail',
        displayName: this.configService.get<string>('LDAP_USER_ATTR_DISPLAY_NAME') || 'cn',
      },
    };
  }

  private createClient(): ldap.Client {
    if (this.client) {
      this.client.unbind();
      this.client.destroy();
    }

    this.client = ldap.createClient({
      url: this.config.url,
      timeout: 5000,
      connectTimeout: 5000,
    });

    this.client.on('error', (err) => {
      this.logger.error('LDAP client error:', err);
    });

    return this.client;
  }

  async authenticate(username: string, password: string): Promise<LdapUser | null> {
    if (!this.config.enabled) {
      this.logger.warn('LDAP authentication attempted but LDAP is not enabled');
      return null;
    }

    const client = this.createClient();

    try {
      // 1. Bind with admin credentials
      await this.bind(client, this.config.bindDn, this.config.bindPassword);

      // 2. Search for user
      const searchFilter = this.config.searchFilter.replace('{{username}}', this.escapeFilter(username));
      const searchResults = await this.search(client, this.config.baseDn, searchFilter);

      if (searchResults.length === 0) {
        this.logger.warn(`LDAP user not found: ${username}`);
        return null;
      }

      const userEntry = searchResults[0];
      const userDn = userEntry.dn;

      // 3. Unbind admin and bind with user credentials to verify password
      await this.unbind(client);

      try {
        await this.bind(client, userDn, password);
      } catch (err) {
        this.logger.warn(`LDAP authentication failed for user: ${username}`);
        return null;
      }

      // 4. Extract user attributes
      const ldapUser: LdapUser = {
        username: this.getAttributeValue(userEntry, this.config.userAttributes.username),
        email: this.getAttributeValue(userEntry, this.config.userAttributes.email),
        displayName: this.getAttributeValue(userEntry, this.config.userAttributes.displayName),
      };

      this.logger.log(`LDAP authentication successful for user: ${username}`);
      return ldapUser;
    } catch (err) {
      this.logger.error('LDAP authentication error:', err);
      return null;
    } finally {
      await this.unbind(client);
    }
  }

  private bind(client: ldap.Client, dn: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(dn, password, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private unbind(client: ldap.Client): Promise<void> {
    return new Promise((resolve) => {
      client.unbind((err) => {
        if (err) {
          this.logger.warn('Error unbinding LDAP client:', err);
        }
        resolve();
      });
    });
  }

  private search(client: ldap.Client, baseDn: string, filter: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const opts: ldap.SearchOptions = {
        scope: 'sub',
        filter,
      };

      const results: any[] = [];

      client.search(baseDn, opts, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        res.on('searchEntry', (entry) => {
          const obj: any = {
            dn: entry.objectName,
          };

          entry.attributes.forEach((attr) => {
            if (attr.values && attr.values.length) {
              const values = Array.isArray(attr.values) ? attr.values : [attr.values];
              const vals = values.map((v: any) => {
                if (Buffer.isBuffer(v)) {
                  return v.toString('utf-8');
                }
                return v;
              });
              obj[attr.type] = vals.length === 1 ? vals[0] : vals;
            }
          });

          results.push(obj);
        });

        res.on('error', (err) => {
          reject(err);
        });

        res.on('end', () => {
          resolve(results);
        });
      });
    });
  }

  private getAttributeValue(entry: any, attributeName: string): string {
    const value = entry[attributeName];
    if (Array.isArray(value)) {
      return value[0] || '';
    }
    return value || '';
  }

  private escapeFilter(str: string): string {
    return str
      .replace(/\\/g, '\\5c')
      .replace(/\*/g, '\\2a')
      .replace(/\(/g, '\\28')
      .replace(/\)/g, '\\29')
      .replace(/\0/g, '\\00');
  }

  async syncGroups(username: string): Promise<string[]> {
    // Optional: sync AD groups to Qubeless roles
    // This can be implemented later if needed
    this.logger.log(`Group sync not yet implemented for user: ${username}`);
    return [];
  }
}
