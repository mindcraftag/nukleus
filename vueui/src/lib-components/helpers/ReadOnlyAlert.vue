<template>
  <v-banner
      class="my-4 ml-1"
      color="warning"
      icon="mdi-lock"
  >
    <v-banner-text>
      {{text}}
    </v-banner-text>

  </v-banner>
</template>
<script>

const READONLY_TEXTS = [
    'This item is read only! Only look, don\'t touch! Seriously! Hands off!!',
    'This item is read only! You can try changing these, but you will only waste your time.',
    'This item is read only! If you manage to change any of these values, you found a bug. Report and receive a cookie.'
];

export default {

  data: () => ({
    text: ""
  }),

  mounted() {
    const index = Math.floor(Math.random() * READONLY_TEXTS.length - 0.01);
    console.log("Readonly index: " + index);
    this.text = READONLY_TEXTS[index];
  }

}

</script>
