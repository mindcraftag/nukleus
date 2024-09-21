<template>
  <div>
    <v-card v-if="plans.length" flat style="margin-bottom: 10px; width: 100%">
      <v-card-text>
        <div style="font-size: 14px; margin-bottom: 10px">
          Here you can see your current choice of plans marked as (Current). You
          can switch your plan anytime. Any changes will be activated hourly.
          Once you select a new plan and save, this choice will be displayed as
          (Next) when you open this page again and the hour has not passed yet.
          After the hourly switch, the next plan will become your current plan
          and you're free to switch again. Should you change your mind while
          your new choice is still in (Next) stage, you can always choose your
          old plan again and save.
        </div>

        <div class="planList">
          <v-card
            v-for="plan in plans"
            :key="plan._id"
            variant="outlined"
            :class="
              selectedPlan === plan._id
                ? 'planCard planCardSelected'
                : 'planCard'
            "
            @click="selectPlan(plan)"
          >
            <v-card-text :style="getTextColor(plan)">
              <h1>
                {{
                  plan.name +
                  (plan._id === currentPlan ? " (Current)" : "") +
                  (plan._id === nextPlan ? " (Next)" : "")
                }}
              </h1>
              {{ plan.description }}

              <p></p>
              <h2>{{ formatPrice(plan.pricing.monthlyBasePrice) }} monthly</h2>
              <h3>
                {{ formatPrice(plan.pricing.storagePricePerGb) }} per GiB
                storage
              </h3>
              <h3>
                {{ formatPrice(plan.pricing.trafficPricePerGb) }} per GiB
                traffic
              </h3>

              <p></p>
              <ul v-for="feature in plan.features" :key="feature">
                <li>{{ feature }}</li>
              </ul>
            </v-card-text>
          </v-card>
        </div>
      </v-card-text>
    </v-card>
    <v-dialog :model-value="showMissingPaymentDialog" max-width="290">
      <v-card>
        <v-card-title class="text-h5">Payment is not setup</v-card-title>

        <v-card-text>
          This plan requires payment, but you have not set up payment yet. Would
          you like to do that now?
        </v-card-text>

        <v-card-actions>
          <div class="flex-grow-1"></div>

          <v-btn
            color="green-darken-1"
            variant="text"
            @click="
              showMissingPaymentDialog = false;
              $emit('setup-payment');
            "
          >
            Yes
          </v-btn>

          <v-btn
            color="green-darken-1"
            variant="text"
            @click="showMissingPaymentDialog = false"
          >
            Cancel
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script>

export default {

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    currentPlan: {
      type: String,
      required: true,
    },
    nextPlan: {
      type: String,
      required: false,
    },
    paymentIsSetup: {
      type: Boolean,
      required: true,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    plans: [],
    selectedPlan: null,
    showMissingPaymentDialog: false,
  }),

  created() {
    this.loadData();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    formatPrice: function (value) {
      const formatter = new Intl.NumberFormat("de-CH", {
        style: "currency",
        currency: "CHF",
        minimumFractionDigits: 2,
      });

      return formatter.format(value / 100);
    },

    planRequiresPayment(plan) {
      if (plan.pricing.monthlyBasePrice > 0) return true;

      if (plan.pricing.storagePricePerGb > 0) return true;

      if (plan.pricing.trafficPricePerGb > 0) return true;

      if (
        plan.pricing.jobInvocationPrices &&
        plan.pricing.jobInvocationPrices.length > 0
      )
        return true;

      return false;
    },
    getTextColor(plan) {
      if (this.$store.state.darkMode) {
        if (plan._id === this.currentPlan) return "color: #ffff80;";

        if (plan._id === this.nextPlan) return "color: #80ff80;";

        return "color: #ffffff";
      } else {
        if (plan._id === this.currentPlan) return "color: #808000;";

        if (plan._id === this.nextPlan) return "color: #008000;";

        return "color: #000000";
      }
    },
    selectPlan(plan) {
      if (this.planRequiresPayment(plan) && !this.paymentIsSetup) {
        this.showMissingPaymentDialog = true;
      } else {
        this.selectedPlan = plan._id;
        this.$emit("plan-selected", plan._id);
      }
    },
    async loadData() {
      try {
        this.plans = await this.$store.state.nkclient.getPlans();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>
<style>
.planList {
  display: flex;
}

.planCard {
  margin: 10px;
}

.planCard h1 {
  margin-bottom: 10px;
}

.planCard h2 {
  margin-bottom: 5px;
}

.planCard h3 {
  margin-bottom: 3px;
}

.planCardSelected {
  border: 2px solid green !important;
}
</style>
