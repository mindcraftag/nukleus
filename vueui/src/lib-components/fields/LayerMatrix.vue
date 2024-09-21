<template>
  <v-btn
    style="width: 100%"
    class="bg-main"
    size="small"
    @click="showEditDialog = true"
  >
    Edit Matrix
  </v-btn>

  <Dialog v-model="showEditDialog" title="Edit matrix">
    <template #default>
      <div style="max-height: 80vh; overflow: auto">
        <table>
          <thead>
          <tr>
            <th></th>
            <th v-for="(col, colIndex) in reversedTitles" :key="colIndex">
              <div class="vertical-text">{{ col }}</div>
            </th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(row, rowIndex) in titles" :key="rowIndex">
            <td>{{ row }}</td>
            <td v-for="(col, colIndex) in titles.length - rowIndex"
                :key="colIndex"
                class="layer-matrix-cell">
              <input type="checkbox"
                     :disabled="!allowEdit"
                     :checked="isInteracting(rowIndex, colIndex)"
                     @click="toggleInteraction(rowIndex, colIndex)" />
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template #actions>
      <v-btn color="normal" @click="showEditDialog = false">
        Close
      </v-btn>
    </template>
  </Dialog>

</template>
<style>

.layer-matrix-cell {
  width: 16px;
  height: 16px;
  max-width: 16px;
  max-height: 16px;
}

.layer-matrix-cell .v-selection-control__wrapper {
  width: 16px !important;
  max-width: 16px !important;
}

.layer-matrix-cell .v-selection-control__wrapper input {
  width: 16px !important;
  max-width: 16px !important;
}

.vertical-text {
  writing-mode: vertical-lr;
  transform: rotate(180deg);
}

</style>
<script>

import Dialog from "../wrappers/Dialog.vue";
import {watch} from "vue";

export default {

  name: "LayerMatrix",

  components: {
    Dialog
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
    layerTitles: {
      type: Array,
      default: []
    }
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    showEditDialog: false,
    interactions: new Map(),
    titles: [],
    reversedTitles: []
  }),

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    computedValue: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value)
        this.$emit('changed')
      },
    },
  },

  // ---------------------------------------------------------
  //  HOOKS
  // ---------------------------------------------------------
  mounted() {
    this.updateInteractions();
    this.updateTitles();

    watch(() => [this.modelValue], () => {
      this.updateInteractions();
    });

    watch(() => [this.layerTitles], () => {
      this.updateTitles();
    });
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    updateTitles() {
      const titles = this.layerTitles.slice();

      while (titles[titles.length-1] === "") {
        titles.pop();
      }

      this.titles = titles;
      this.reversedTitles = this.titles.slice().reverse();
    },
    updateInteractions() {
      const source = Array.isArray(this.computedValue) ? this.computedValue : [];
      const keys = Array.from(Array(this.layerTitles.length).keys());
      const arr = keys.map(row => [row, source[row] || []]);
      this.interactions = new Map(arr);
    },
    isInteracting(rowIndex, colIndex) {
      colIndex = this.titles.length - colIndex - 1;
      return this.interactions.get(rowIndex).includes(colIndex);
    },
    toggleInteraction(rowIndex, colIndex) {
      if (!this.allowEdit)
        return;

      colIndex = this.titles.length - colIndex - 1;
      const interactionsForRow = this.interactions.get(rowIndex);
      if (interactionsForRow.includes(colIndex)) {
        interactionsForRow.splice(interactionsForRow.indexOf(colIndex), 1);
      } else {
        interactionsForRow.push(colIndex);
      }

      const value = [];
      for (const row of this.interactions.values()) {
        value.push(row.slice());
      }

      this.computedValue = value;
    }
  }
}
</script>
