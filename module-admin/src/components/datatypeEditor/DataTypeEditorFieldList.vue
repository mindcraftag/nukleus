<template>
  <div style="width: 100%">
    <div class="d-flex flex-row">
      <div class="field-name">
        Label:
      </div>
      <div class="field-value">
        <v-text-field dense v-model="field.displayName" @input="changed" />
      </div>
      <div class="field-name">
        Name:
      </div>
      <div class="field-value">
        <v-text-field dense v-model="field.name" @input="changed" />
      </div>
    </div>
    <div>
      <DataTypeEditor v-model="field.fields" :datatypes="datatypes" @input="changed"></DataTypeEditor>
    </div>
  </div>
</template>

<script>

export default {

  props: {
    value: {
      type: Object,
      required: true
    },
    datatypes: {
      type: Array,
      required: true
    }
  },

  computed: {
    field: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },

  methods: {
    changed() {
      this.$emit('input', this.value);
    }
  }

}
</script>
