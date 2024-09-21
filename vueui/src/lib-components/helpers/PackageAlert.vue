<template>
  <v-banner
      class="my-4 ml-1"
      color="blue"
      icon="$warning"
  >
    <v-banner-text>
      This item is part of a package. You can unpack it to your project to make it editable.
    </v-banner-text>

    <template v-slot:actions>
      <v-btn @click="unpack">Unpack now</v-btn>
    </template>
  </v-banner>
</template>
<script>

export default {
  methods: {
    unpack() {
      this.$store.commit('setMessage', "This is not implemented yet. Come back later :)");
    }
  }
}

</script>
