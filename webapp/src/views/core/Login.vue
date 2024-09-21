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
            <v-card v-if="!loginSent" class="elevation-1 pa-3">
              <v-card-title>Welcome to Nukleus. Please login.</v-card-title>
              <v-card-text>
                <v-form>
                  <v-text-field
                    v-model="userEmail"
                    append-icon="mdi-account"
                    data-test="loginTextField"
                    name="login"
                    label="Login"
                    type="text"
                    variant="outlined"
                    density="compact"
                    :error="showError"
                    :rules="[rules.required]"
                    @keydown="keydownLogin"
                  />
                  <v-text-field
                    id="password"
                    v-model="password"
                    :type="hidePassword ? 'password' : 'text'"
                    :append-icon="hidePassword ? 'mdi-eye-off' : 'mdi-eye'"
                    variant="outlined"
                    density="compact"
                    data-test="passwordTextField"
                    name="password"
                    label="Password"
                    :rules="[rules.required]"
                    :error="showError"
                    @keydown="keydownLogin"
                    @click:append="hidePassword = !hidePassword"
                  />
                </v-form>
                <v-spacer></v-spacer>
                <v-btn
                  data-test="loginButton"
                  block
                  color="primary"
                  :loading="loading"
                  @click="login"
                  >Login</v-btn
                >
                <!--br/>
                <v-btn data-test="registerButton" block @click="register">Register new account</v-btn-->
                <br />
                <v-btn
                  data-test="forgotPasswordButton"
                  block
                  @click="forgotPassword"
                  >I forgot my password</v-btn
                >
              </v-card-text>
            </v-card>

            <v-card v-if="loginSent" class="elevation-1 pa-3">
              <v-card-title
                >Please enter the 2FA code you got by mail.</v-card-title
              >
              <v-card-text>
                <v-form>
                  <v-text-field
                    v-model="twoFactorCode"
                    append-icon="mdi-account"
                    data-test="twoFactorCodeTextField"
                    name="twoFactorCode"
                    type="text"
                    variant="outlined"
                    density="compact"
                    :error="showError"
                    @keydown="keydownConfirm2FA"
                  />
                </v-form>
                <v-spacer></v-spacer>
                <v-btn
                  data-test="confirmButton"
                  block
                  color="primary"
                  :loading="loading"
                  @click="confirm2FA"
                  >Confirm</v-btn
                >
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
      <v-snackbar
        v-model="showMessage"
        :timeout="4000"
        color="success"
        location="top"
      >
        {{ message }}
      </v-snackbar>
    </v-main>
  </v-app>
</template>

<script>

export default {
  data() {
    return {
      loading: false,
      userEmail: "",
      password: "",
      hidePassword: true,
      loginSent: false,
      twoFactorCode: null,
      rules: {
        required: (value) => !!value || "Required.",
      },
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
    showMessage: {
      get: function () {
        return this.message != null && this.message.length > 0;
      },
      set: function (value) {
        if (value === false) {
          this.$store.state.message = null;
        }
      },
    },
    message: {
      get: function () {
        return this.$store.state.message;
      },
    },
  },

  methods: {
    keydownLogin(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        this.login();
      }
    },
    keydownConfirm2FA(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        this.confirm2FA();
      }
    },
    register() {
      this.$router.push({ name: "Register" });
    },
    forgotPassword() {
      this.$router.push({ name: "ForgotPassword" });
    },
    async confirm2FA() {
      try {
        const response = await this.$store.state.nkclient.confirm2FA(
          this.userEmail,
          this.twoFactorCode,
        );

        this.$store.commit({
          type: "setAuthenticated",
          authenticated: true,
          token: response,
        });

        // wait until authentication is done and user and permissions data is available. Only then
        // do we switch to the items page.
        const _this = this;
        this.$store.state.nkclient.eventBus.$once("permissionsUpdate", function () {
          _this.$router.push({ name: "Items" });
        });
      } catch (err) {
        console.error(err);
        this.$store.commit({
          type: "setAuthenticated",
          authenticated: false,
          token: "",
        });
        this.$store.commit("setError", err.toString());
      }
    },
    async login() {
      if (!this.userEmail || !this.password) {
        this.result = "Email and Password can't be null.";
        this.showResult = true;
        return;
      }

      try {
        await this.$store.state.nkclient.login2FA(
          this.userEmail,
          this.password,
        );
        this.loginSent = true;
      } catch (err) {
        console.error(err);
        this.$store.commit({
          type: "setAuthenticated",
          authenticated: false,
          token: "",
        });
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style scoped lang="css">
#login {
  height: 50%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  content: "";
  z-index: 0;
}
</style>
