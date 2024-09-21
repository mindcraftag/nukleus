<template>
  <div @contextmenu.prevent>
    <template v-if="!$route.meta.allowAnonymous">
      <v-app id="nukleus" :theme="$store.state.darkMode ? 'dark' : 'light'">
        <div class="app-container">
          <toolbar @toggleNavigationBar='drawer = !drawer'/>
          <navigation v-model="drawer"/>
          <v-main>
            <breadcrumbs />
            <router-view/>
          </v-main>
        </div>
      </v-app>
    </template>
    <template v-else>
      <transition>
        <keep-alive>
          <router-view></router-view>
        </keep-alive>
      </transition>
    </template>
  </div>
</template>

<script>

export default {
  name: 'App',
  data() {
    return {
      drawer: null
    }
  },

  mounted() {

    const _this = this;
    const nkclient = this.$store.state.nkclient;

    nkclient.$on('nk:client:redirect', function(name) {
      _this.$router.push({name: name});
    });

    nkclient.$on('nk:client:unauthorized', function() {
      _this.$store.commit('setAuthenticated', false, "");
      _this.$router.push({name: "Login"});
    });
  }
}

</script>

<style>

</style>
