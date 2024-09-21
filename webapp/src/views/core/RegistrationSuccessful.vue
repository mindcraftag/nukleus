<template>
  <v-app id="login" class="bg-secondary" light>
    <div
      class="background-holder"
    ></div>
    <v-app-bar app flat color="rgba(0, 0, 0, 0)">

    </v-app-bar>
    <v-main>
      <v-container fluid fill-height style="max-width: 500px">
        <v-row align-center justify-center>
          <v-col xs12 sm8 md4 lg4>
            <v-card class="elevation-1 pa-3">
              <v-card-title>Success</v-card-title>
              <v-card-text>
                Your registration was sent successfully. You should receive an
                email shortly for confirmation.
                <br />
                <v-btn data-test="loginButton" block @click="login"
                  >Back to login</v-btn
                >
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
export default {
  created() {

  },
  methods: {
    login() {
      this.$router.push({ name: "Login" });
    },
  },
};
</script>
