<template>
  <v-app id="login" class="bg-secondary" theme="light">
    <div
      class="background-holder"
    ></div>
    <v-app-bar color="rgba(0, 0, 0, 0)">

    </v-app-bar>
    <v-main>
      <v-container fluid fill-height style="max-width: 500px">
        <v-row align-center justify-center>
          <v-col xs12 sm8 md4 lg4>
            <v-card class="elevation-1 pa-3">
              <v-card-title>Email confirmation</v-card-title>
              <v-card-text>
                <div v-if="!confirmationFailed && !confirmationSucceeded">
                  Confirmation in progress. Please wait...
                </div>
                <div v-if="confirmationSucceeded">
                  Your email change was confirmed.
                </div>
                <div v-if="confirmationFailed">
                  There was an issue with confirming your email address. Please
                  try again later or get in touch with us.
                </div>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn id="loginButton" block color="primary" @click="login"
                  >Go to Login</v-btn
                >
              </v-card-actions>
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
      confirmationSucceeded: false,
      confirmationFailed: false,
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

  created() {
    this.confirm();
  },

  methods: {
    login() {
      this.$router.push({ name: "Login" });
    },

    async confirm() {
      try {
        const token = this.$route.params.token;
        await this.$store.state.nkclient.confirmEmailChange(token);
        this.confirmationSucceeded = true;
      } catch (err) {
        this.confirmationFailed = true;
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style></style>
