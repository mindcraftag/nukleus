<template>
  <v-app id="login" class="bg-secondary" theme="light">
    <div
      class="background-holder"
    ></div>
    <v-app-bar app flat color="rgba(0, 0, 0, 0)">

    </v-app-bar>
    <v-main>
      <v-container fluid fill-height style="max-width: 500px">
        <v-row align-center justify-center>
          <v-col xs12 sm8 md4 lg4>
            <v-card v-if="!requestSent" class="elevation-1 pa-3">
              <v-card-title
                >Please enter your email address and we'll send you a password
                reset email</v-card-title
              >
              <v-card-text>
                <v-form>
                  <v-text-field
                    id="regAccount"
                    v-model="account"
                    name="regAccount"
                    label="EMail Address"
                  />
                </v-form>
                <v-spacer></v-spacer>
                <v-btn
                  id="forgotPasswordButton"
                  block
                  color="primary"
                  @click="submit"
                  >Request password reset</v-btn
                >
                <br />
                <v-btn data-test="loginButton" block @click="login"
                  >Back to login</v-btn
                >
              </v-card-text>
            </v-card>
            <v-card v-else class="elevation-1 pa-3">
              <v-card-title>Request was sent.</v-card-title>
              <v-card-text>
                Please check your inbox for an email from us.
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
      <v-snackbar
        v-model="showError"
        :timeout="4000"
        color="error"
        location="top"
      >
        {{ error }}
      </v-snackbar>
    </v-main>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      account: "",
      requestSent: false,
    };
  },

  computed: {
    showError: {
      get: function () {
        return this.error != null && this.error.length > 0;
      },
      set: function (value) {
        if (value === false) {
          this.$store.state.error = null;
        }
      },
    },
    error: {
      get: function () {
        return this.$store.state.error;
      },
    },
  },

  methods: {
    login() {
      this.$router.push({ name: "Login" });
    },

    async submit() {
      if (!this.account) {
        this.result = "Please enter your email address";
        this.showResult = true;
        return;
      }

      try {
        await this.$store.state.nkclient.forgotPassword(this.account);
        this.requestSent = true;
        this.$store.commit("setMessage", "Request sent");
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style></style>
