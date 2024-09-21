<template>
  <div style="height: 200px; padding: 0; overflow: auto; background: transparent;">
    <table style="width: 100%">
      <tbody>
        <tr
          v-for="(item, index) in items"
          :key="index"
        >
          <td style="width: 24px">{{ index }}</td>
          <td>
            <div class="fieldValueContainer">
              <SmallTextField
                v-model="items[index]"
                density="compact"
                :readonly="!allowEdit"
                @change="changed"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style></style>
<script>

import SmallTextField from "../wrappers/SmallTextField.vue";

export default {

  name: "StringList",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    SmallTextField
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    allowEdit: {
      type: Boolean,
      required: true,
      default: false,
    },
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    isFixedLength: {
      get() {
        return this.computedValue.fixedLength;
      }
    },
    items: {
      get() {
        return this.computedValue.value;
      },
      set(value) {
        this.computedValue.value = value;
      }
    },
    computedValue: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value);
        this.$emit('changed');
      },
    },
  },

  methods: {
    changed() {
      // Set the value to itself. As stupid as this looks, we need to do it to trigger the proxy
      // to notice the change.
      this.items = JSON.parse(JSON.stringify(this.items));
    }
  }
}
</script>
