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
        <SlimFormCard title="Contact" :divider="false">
          <template #default>
            <table style="width: 100%">
              <tr>
                <td class="fieldName">Name</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="name" required></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Email (for invoices)</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="email"></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Name on invoice (optional)</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="addressName"></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Street</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="street"></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Zipcode</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="zipcode"></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">City</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="city"></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Country</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="country"></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">VAT ID (optional)</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="vatNo"></SmallTextField>
                  </div>
                </td>
              </tr>
            </table>

            <v-alert
              v-if="emailToConfirm && emailToConfirm.length > 0"
              border="start"
              type="info"
            >
              You recently changed your email address to {{ emailToConfirm }}.
              You should have received an email for confirmation before this
              gets activated.
            </v-alert>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Access control" :divider="false">
          <template #default>
            <div style="font-size: 14px; margin-bottom: 10px">
              The base access control list allows you to assign default
              permissions for all users of your organization. If you do not
              specify any entries here, all users will be allowed to read, write
              or publish files as they wish. Creating any entry here will
              disable this fallback and your definitions will be the default.
            </div>

            <AclEditor
              :element="client"
              :allow-edit="true"
              :client-mode="true"
            ></AclEditor>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Payment" :divider="false">
          <template #default>
            <div
              v-if="paymentIsSetup"
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

      <v-col lg="12" md="12" sm="12" xs="12">
        <SlimFormCard title="Plans" :divider="false">
          <template #default>
            <PlanSelector
              v-if="currentPlan"
              :current-plan="currentPlan"
              :next-plan="nextPlan"
              :payment-is-setup="paymentIsSetup"
              @plan-selected="planSelected"
              @setup-payment="startCheckout"
            >
            </PlanSelector>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="12" md="12" sm="12" xs="12">
        <SlimFormCard title="Invoices" :divider="false">
          <template #default>
            <InvoicesList :user-mode="false" />
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="12" md="12" sm="12" xs="12">
        <SlimFormCard title="Metrics" :divider="false">
          <template #default>
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">Metric</th>
                  <th class="text-left">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Stored files:</td>
                  <td>{{ metrics.storedCount }}</td>
                </tr>
                <tr>
                  <td>Stored bytes:</td>
                  <td>{{ formatBytes(metrics.storedBytes) }}</td>
                </tr>
                <tr>
                  <td>Transmitted files:</td>
                  <td>{{ metrics.trafficCount }}</td>
                </tr>
                <tr>
                  <td>Transmitted bytes:</td>
                  <td>{{ formatBytes(metrics.trafficBytes) }}</td>
                </tr>
                <tr>
                  <td>Transmitted files (this month):</td>
                  <td>{{ metrics.trafficMonthCount }}</td>
                </tr>
                <tr>
                  <td>Transmitted bytes (this month):</td>
                  <td>{{ formatBytes(metrics.trafficMonthBytes) }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col
        v-if="features.includes('custom_jobagents')"
        lg="12" md="12" sm="12" xs="12"
      >
        <SlimFormCard title="Access Tokens" :divider="false">
          <template #default>
            <ApiTokenList
              :tokens="accessTokens"
              type="access"
              @reload="loadAccessTokens"
            ></ApiTokenList>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col
        v-if="features.includes('custom_jobagents')"
        lg="12" md="12" sm="12" xs="12"
      >
        <SlimFormCard title="Job Types" :divider="false">
          <template #default>
            <JobTypeList
              v-if="client"
              :enabled-types="client.enabledClientJobTypes"
              :set-enabled-types="setEnabledTypes"
            />
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="12" md="12" sm="12" xs="12">
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <v-btn color="primary" @click="submit">
                  <v-icon>mdi-content-save</v-icon>
                  save
                </v-btn>
                <v-btn @click="cancel">
                  <v-icon>mdi-close</v-icon>
                  close
                </v-btn>
              </v-col>
            </v-row>
          </v-container>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { AclEditor, SlimFormCard, SmallTextField } from "@mindcraftgmbh/nukleus-vueui";
import InvoicesList from "../components/InvoicesList";
import PlanSelector from "../components/PlanSelector";
import { loadStripe } from "@stripe/stripe-js";
import ApiTokenList from "../components/ApiTokenList";
import JobTypeList from "../components/JobTypeList";
import {config} from "../config";

export default {
  components: {
    InvoicesList,
    PlanSelector,
    AclEditor,
    SlimFormCard,
    ApiTokenList,
    JobTypeList,
    SmallTextField
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    client: null,
    clientId: null,
    currentPlan: null,
    nextPlan: null,
    stripe: null,
    accessTokens: [],
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    name: {
      get() {
        if (this.client) {
          return this.client.name;
        }
        return "";
      },
      set(value) {
        if (this.client) {
          this.client.name = value;
        }
      },
    },
    email: {
      get() {
        if (this.client && this.client.address) {
          return this.client.address.email;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.address) {
          this.client.address.email = value;
        }
      },
    },
    addressName: {
      get() {
        if (this.client && this.client.address) {
          return this.client.address.name;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.address) {
          this.client.address.name = value;
        }
      },
    },
    emailToConfirm: {
      get() {
        if (this.client && this.client.address) {
          return this.client.address.emailToConfirm;
        }
        return "";
      },
    },
    street: {
      get() {
        if (this.client && this.client.address) {
          return this.client.address.street;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.address) {
          this.client.address.street = value;
        }
      },
    },
    zipcode: {
      get() {
        if (this.client && this.client.address) {
          return this.client.address.zipcode;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.address) {
          this.client.address.zipcode = value;
        }
      },
    },
    city: {
      get() {
        if (this.client && this.client.address) {
          return this.client.address.city;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.address) {
          this.client.address.city = value;
        }
      },
    },
    country: {
      get() {
        if (this.client && this.client.address) {
          return this.client.address.country;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.address) {
          this.client.address.country = value;
        }
      },
    },
    vatNo: {
      get() {
        if (this.client) {
          return this.client.vatNo;
        }
        return "";
      },
      set(value) {
        if (this.client) {
          this.client.vatNo = value;
        }
      },
    },
    paymentIsSetup: {
      get() {
        if (this.client) {
          return this.client.paymentIsSetup;
        }
        return "";
      },
    },
    paymentCard: {
      get() {
        if (this.client) {
          return this.client.paymentCard;
        }
        return "";
      },
    },
    metrics: {
      get() {
        if (this.client) {
          return this.client.metrics;
        }
        return {};
      },
    },
    features: {
      get() {
        if (this.client) {
          return this.client.features;
        }
        return [];
      },
    },
  },

  // --------------------------------------------------------
  //  CREATED
  // --------------------------------------------------------
  async created() {
    await this.loadClient();
    await this.initStripe();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    formatBytes: function (value) {
      if (!value) return "0 KiB";

      const kb = Math.ceil(value / 1024);
      if (kb < 1024) return kb + " KiB";
      else return Math.ceil((kb / 1024) * 100) / 100 + " MiB";
    },
    async initStripe() {
      this.stripe = await loadStripe(config.stripeKey);
    },

    async startCheckout() {
      try {
        const successUrl = `${config.webUrl}/myorganization`;
        const cancelUrl = `${config.webUrl}/myorganization`;

        const session = await this.$store.state.nkclient.paymentStartCheckout(
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

    planSelected(plan) {
      this.client.nextPlan = plan;
    },

    async loadClient() {
      try {
        this.client = await this.$store.state.nkclient.myClient();
        this.clientId = this.client._id;
        this.currentPlan = this.client.currentPlan;
        this.nextPlan = this.client.nextPlan;

        if (this.client.features.includes("custom_jobagents")) {
          await this.loadAccessTokens();
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async submit() {
      try {
        await this.$store.state.nkclient.saveMyClient(this.client);
        this.$store.commit("setActiveClientName", this.client.name);
        this.$router.go(-1);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    cancel() {
      this.$router.go(-1);
    },
    async loadAccessTokens() {
      try {
        this.accessTokens =
          await this.$store.state.nkclient.getClientAccessTokens();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    setEnabledTypes(newTypes) {
      this.client.enabledClientJobTypes = newTypes;
    },
  },
};
</script>

<style></style>
