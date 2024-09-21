<template>
  <v-dialog v-model="showDialog" width="300">
    <v-card>
      <v-color-picker v-model="pickerValue" width="300"></v-color-picker>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" text @click="$emit('input', false)">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script>

export default {

  props: {
    value: {
      type: Boolean,
      default: true
    },
    color: {
      type: Object
    }
  },

  computed: {
    showDialog: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    },
    pickerValue: {
      get() {
        return {
          r: this.color.r,
          g: this.color.g,
          b: this.color.b,
          a: this.color.a / 255
        };
      },
      set(value) {
        this.$emit('color-changed', {
          r: value.r,
          g: value.g,
          b: value.b,
          a: Math.floor(value.a * 255)
        });
      }
    }
  }

}

</script>
