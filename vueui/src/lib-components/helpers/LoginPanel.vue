<template>
  <div>
    <v-container fluid fill-height>
      <v-row align-center justify-center>
        <v-col xs12 sm8 md4 lg4>
          <v-card class="elevation-1 pa-3">
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
                  @keydown="keydown"
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
  </div>
</template>

<script>

export default {
  data() {
    return {
      userEmail: '',
      password: '',
      hidePassword: true,
      rules: {
        required: (value) => !!value || 'Required.',
      },
    }
  },

  computed: {
    showError: {
      get: function () {
        return this.error != null && this.error.length > 0
      },
      set: function (value) {
        if (value === false) {
          this.$store.state.error = null
        }
      },
    },
    error: {
      get: function () {
        return this.$store.state.error
      },
    },
    showMessage: {
      get: function () {
        return this.message != null && this.message.length > 0
      },
      set: function (value) {
        if (value === false) {
          this.$store.state.message = null
        }
      },
    },
    message: {
      get: function () {
        return this.$store.state.message
      },
    },
  },

  methods: {
    keydown(event) {
      if (event.key === 'Enter') {
        this.login()
      }
    },
    async login() {
      const vm = this

      if (!vm.userEmail || !vm.password) {
        vm.result = "Email and Password can't be null."
        vm.showResult = true
        return
      }

      try {
        const response = await this.$store.state.nkclient.login({
          account: vm.userEmail,
          password: vm.password,
        })

        vm.$store.commit({
          type: 'setAuthenticated',
          authenticated: true,
          token: response,
        })

        // wait until authentication is done and user and permissions data is available. Only then
        // do we switch to the items page.
        this.$store.state.nkclient.eventBus.$once('permissionsUpdate', function () {
          vm.$emit('success')
        })
      } catch (err) {
        console.error(err)
        vm.$store.commit({
          type: 'setAuthenticated',
          authenticated: false,
          token: '',
        })
        this.$store.commit('setError', err.toString())
      }
    },
  },
}
</script>

<style scoped lang="css">
#login {
  height: 50%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  content: '';
  z-index: 0;
}
</style>
