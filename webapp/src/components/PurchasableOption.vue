<template>
  <div style="margin-bottom: 10px">
    <table style="width: 100%">
      <tr>
        <td class="fieldName">Name</td>
        <td class="fieldValue">
          <div class="fieldValueContainer">
            <SmallTextField
              v-model="option.name"
              data-test="nameTextField"
              required
            ></SmallTextField>
          </div>
        </td>
      </tr>
      <tr v-for="currency in supportedCurrencies" :key="currency">
        <td class="fieldName">Price in {{ currency.toUpperCase() }}</td>
        <td class="fieldValue">
          <div class="fieldValueContainer">
            <SmallTextField
              v-model="option.prices[currency]"
              data-test="priceTextField"
              type="number"
              required
            ></SmallTextField>
          </div>
        </td>
      </tr>
      <tr>
        <td class="fieldName">Interval</td>
        <td class="fieldValue">
          <div class="fieldValueContainer">
            <SmallSelect
              v-model="option.interval"
              data-test="intervalSelection"
              :items="intervals"
              required
            ></SmallSelect>
          </div>
        </td>
      </tr>
    </table>

    <v-btn variant="text" style="float: right" @click="$emit('remove', option)">
      delete
    </v-btn>
  </div>
</template>
<script>

import { SmallTextField, SmallSelect } from '@mindcraftgmbh/nukleus-vueui'

export default {

  components: {
    SmallTextField,
    SmallSelect
  },

  props: {
    option: {
      type: Object,
      required: true,
    },
  },

  data: () => ({
    intervals: ["once", "monthly", "yearly"],
    supportedCurrencies: [],
  }),

  async mounted() {
    this.supportedCurrencies =
      await this.$store.state.nkclient.getSupportedCurrencies();
  },
};
</script>
