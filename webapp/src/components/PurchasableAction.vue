<template>
  <div style="margin-bottom: 10px">
    <table style="width: 100%">
      <tr>
        <td class="fieldName">Type</td>
        <td class="fieldValue">
          <div class="fieldValueContainer">
            <SmallSelect
              v-model="action.type"
              data-test="typeSelection"
              :items="types"
              required
            ></SmallSelect>
          </div>
        </td>
      </tr>
      <tr>
        <td class="fieldName">Params</td>
        <td class="fieldValue">
          <div class="fieldValueContainer">
            <SmallTextField
              v-model="paramsStringComputed"
              data-test="paramsTextField"
              required
            ></SmallTextField>
          </div>
        </td>
      </tr>
      <tr v-if="error">
        <td colspan="2" style="color: red">
          {{ error }}
        </td>
      </tr>
    </table>

    <v-btn variant="text" style="float: right" @click="$emit('remove', action)">
      delete
    </v-btn>
  </div>
</template>
<script>

import { watch } from 'vue'
import { SmallTextField, SmallSelect } from '@mindcraftgmbh/nukleus-vueui'

export default {

  components: {
    SmallTextField,
    SmallSelect
  },

  props: {
    action: {
      type: Object,
      required: true,
    },
  },

  data: () => ({
    types: [
      "assign_permission",
      "revoke_permission",
      "set_user_quota_gb",
      "add_to_group",
      "remove_from_group",
    ],
    paramsString: null,
    error: "",
  }),

  computed: {
    paramsStringComputed: {
      get() {
        if (!this.paramsString)
          this.paramsString = JSON.stringify(this.action.params);

        return this.paramsString;
      },
      set(value) {
        this.paramsString = value;
        try {
          this.action.params = JSON.parse(value);
          this.error = null;
        } catch (err) {
          this.error = err;
        }
      },
    },
  },

  created() {
    watch(() => [this.action], () => {
      this.paramsString = null;
    });
  }

};
</script>
