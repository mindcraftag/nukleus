<template>
  <v-container fluid grid-list-xl>
    <v-row wrap>

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-card-actions>
            <v-btn color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn @click="cancel">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Avatar" :divider="false">
          <template #default>
            <Avatar
              v-if="avatarUserId != null"
              :size="128"
              :user-id="avatarUserId"
            ></Avatar>

            <v-file-input
              v-model="avatarFile"
              :rules="avatarRules"
              accept="image/png, image/jpeg"
              placeholder="Pick an avatar"
              prepend-icon="mdi-camera"
              variant="underlined"
              label="Pick an avatar"
            ></v-file-input>

            <v-btn
              v-if="avatarFile !== null"
              color="primary"
              @click="uploadAvatar"
            >
              <v-icon>mdi-content-save</v-icon>
              upload
            </v-btn>
            <v-btn v-if="avatarUserId" color="primary" @click="clearAvatar">
              <v-icon>mdi-content-trash</v-icon>
              clear
            </v-btn>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Account" :divider="false">
          <template #default>
            <table style="width: 100%">
              <tr>
                <td class="fieldName">Email</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="account" required></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr v-if="emailToConfirm && emailToConfirm.length > 0">
                <td colspan="2">
                  <v-alert border="start" type="info">
                    You recently changed your email address to
                    {{ emailToConfirm }}. You should have received an email for
                    confirmation before this gets activated.
                  </v-alert>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Name</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="name" required></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">New password</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="passwordNew"
                      :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                      :rules="[rules.required, rules.min]"
                      :type="showPassword ? 'text' : 'password'"
                      @click:append="showPassword = !showPassword"
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Confirm password</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="passwordConfirmation"
                      :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                      :type="showPassword ? 'text' : 'password'"
                      @click:append="showPassword = !showPassword"
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Permissions" :divider="false">
          <template #default>
            <div v-if="admin" style="font-size: 14px">
              You are administrator and therefore have full access to all
              functionality.
            </div>

            <PermissionsEditor
              v-if="!admin"
              v-model="permissions"
              :readonly="true"
            />
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="API Tokens" :divider="false">
          <template #default>
            <ApiTokenList
              :tokens="apiTokens"
              type="api"
              @reload="loadApiTokens"
            ></ApiTokenList>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Payment" :divider="false">
          <template #default>
            <div
              v-if="paymentSetup"
              style="font-size: 14px; margin-bottom: 10px; color: green"
            >
              You currently have payment set up. If you want to change it, press
              the button below. Current payment is of type: {{ paymentCard }}
            </div>
            <div
              v-else
              style="font-size: 14px; margin-bottom: 10px; color: red"
            >
              You currently have NO payment set up. Press the button below to
              set it up
            </div>

            <v-btn @click="startCheckout">Configure payment</v-btn>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col v-if="paymentSetup" lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Invoice address" :divider="false">
          <template #default>
            <table style="width: 100%">
              <tr>
                <td class="fieldName">Email address</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressEmail"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Name</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressName"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Street</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressStreet"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Zipcode</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressZipcode"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">City</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressCity"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Country</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressCountry"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col v-if="storageQuotaEnabled" lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Storage quota" :divider="false">
          <template #default>
            <v-progress-linear
              color="#80c0f0"
              :model-value="storageUsedPercent"
              height="25"
            >
              {{ storageUsedGb }} / {{ storageQuotaGb }} GiB
            </v-progress-linear>

            <div style="font-size: 14px; margin-top: 10px">
              This space has quota enabled for users. This means you have a
              limited amount of data you can store in your home directory. After
              this is used up, you will not be able to upload any more data.
            </div>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Invoices" :divider="false">
          <template #default>
            <InvoicesList :user-mode="true" />
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-card-actions>
            <v-btn color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn @click="cancel">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import PermissionsEditor from "../components/PermissionsEditor.vue";
import ApiTokenList from "../components/ApiTokenList";
import Avatar from "../components/Avatar";
import InvoicesList from "../components/InvoicesList";
import {config} from "../config";

import { SlimFormCard, SmallTextField } from "@mindcraftgmbh/nukleus-vueui";
import { loadStripe } from "@stripe/stripe-js";

export default {
  components: {
    PermissionsEditor,
    ApiTokenList,
    Avatar,
    SlimFormCard,
    InvoicesList,
    SmallTextField
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    user: null,
    passwordNew: "",
    passwordConfirmation: "",
    showPassword: false,
    permissionsRaw: [],
    permissions: [],
    apiTokens: [],
    avatarUserId: null,
    avatarFile: null,
    stripe: null,
    avatarRules: [
      (value) =>
        !value ||
        value.size < 2000000 ||
        "Avatar size should be less than 2 MB!",
    ],
    rules: {
      required: (value) => !!value || "Required.",
      min: (v) => v.length >= 8 || "Min 8 characters",
    },
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    account: {
      get() {
        if (this.user) {
          return this.user.account;
        }
        return "";
      },
      set(value) {
        if (this.user) {
          this.user.account = value;
        }
      },
    },
    name: {
      get() {
        if (this.user) {
          return this.user.name;
        }
        return "";
      },
      set(value) {
        if (this.user) {
          this.user.name = value;
        }
      },
    },
    emailToConfirm: {
      get() {
        if (this.user) {
          return this.user.emailToConfirm;
        }
        return "";
      },
    },
    admin: {
      get() {
        if (this.user) {
          return this.user.admin;
        }
        return "";
      },
    },
    selectedPermissions: {
      get() {
        const selectedPermissions = [];
        for (const permission of this.permissions) {
          if (permission.checked) {
            selectedPermissions.push(permission.name);
          }
        }
        return selectedPermissions;
      },
      set(value) {
        if (!Array.isArray(value)) return;

        const permissions = this.permissionsRaw.concat();

        for (const hasPermission of value) {
          for (const permission of permissions) {
            if (permission.name === hasPermission) {
              permission.checked = true;
            }
          }
        }

        this.permissions = permissions;
      },
    },
    storageQuotaEnabled: {
      get() {
        if (this.user) return !!this.user.storageQuotaGb;

        return false;
      },
    },
    storageQuotaGb: {
      get() {
        if (this.user) return this.user.storageQuotaGb;

        return 0;
      },
    },
    storageUsedGb: {
      get() {
        if (this.user) return Math.ceil(this.user.storageUsedGb * 1000) / 1000;

        return 0;
      },
    },
    storageUsedPercent: {
      get() {
        return Math.ceil((this.storageUsedGb / this.storageQuotaGb) * 100);
      },
    },
    paymentSetup: {
      get() {
        if (this.user) return this.user.paymentSetup;

        return null;
      },
    },
    paymentSetupDetails: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.cardInfo
        ) {
          const ci = this.user.paymentSetup.cardInfo;
          return `${ci.brand} (Expires ${ci.exp_month}/${ci.exp_year})`;
        } else {
          return "";
        }
      },
    },
    paymentSetupAddressEmail: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.email;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.email = value;
      },
    },
    paymentSetupAddressName: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.name;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.name = value;
      },
    },
    paymentSetupAddressStreet: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.street;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.street = value;
      },
    },
    paymentSetupAddressZipcode: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.zipcode;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.zipcode = value;
      },
    },
    paymentSetupAddressCity: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.city;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.city = value;
      },
    },
    paymentSetupAddressCountry: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.country;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.country = value;
      },
    },
    userPurchasesEnabled: {
      get() {
        return this.$store.state.activeClientUserPurchasesEnabled;
      },
    },
    paymentCard: {
      get() {
        return `${this.paymentSetup.cardInfo.brand} (...${this.paymentSetup.cardInfo.last4}). Expires ${this.paymentSetup.cardInfo.exp_month}/${this.paymentSetup.cardInfo.exp_year}`;
      },
    },
  },

  // --------------------------------------------------------
  //  CREATED
  // --------------------------------------------------------
  async created() {
    await this.loadPermissions();
    await this.loadUser();
    await this.loadApiTokens();
    await this.initStripe();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async loadPermissions() {
      try {
        this.permissionsRaw =
          await this.$store.state.nkclient.getPermissionsList();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async loadApiTokens() {
      try {
        this.apiTokens = await this.$store.state.nkclient.getApiTokens();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async loadUser() {
      try {
        this.user = await this.$store.state.nkclient.me();
        console.log(this.user);
        this.selectedPermissions = this.user.permissions;
        this.reloadAvatar();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async submit() {
      try {
        if (this.passwordNew !== this.passwordConfirmation) {
          this.$store.commit("setError", "Passwords don't match!");
          return;
        }

        await this.$store.state.nkclient.updateMyProfile({
          account: this.account,
          name: this.name,
          password: this.passwordNew,
          paymentSetup: this.user.paymentSetup,
        });

        this.$router.go(-1);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    cancel() {
      this.$router.go(-1);
    },

    async uploadAvatar() {
      try {
        await this.$store.state.nkclient.uploadAvatar(this.avatarFile);
        this.avatarFile = null;
        this.reloadAvatar();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async clearAvatar() {
      try {
        await this.$store.state.nkclient.clearAvatar();
        this.reloadAvatar();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    reloadAvatar() {
      if (!this.user) return;

      const _this = this;
      _this.avatarUserId = null;
      this.$nextTick(function() {
        _this.avatarUserId = _this.user._id;
      });
    },

    async initStripe() {
      this.stripe = await loadStripe(config.stripeKey);
    },

    async startCheckout() {
      try {
        const successUrl = `${config.webUrl}/myprofile`;
        const cancelUrl = `${config.webUrl}/myprofile`;

        const session =
          await this.$store.state.nkclient.paymentStartUserCheckout(
            successUrl,
            cancelUrl,
          );
        const result = await this.stripe.redirectToCheckout({
          sessionId: session.id,
        });

        console.log(result);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style></style>
