<template>
  <div :class="cssClasses">
    <div class="option-item d-flex flex-row" v-for="(category, index) in categories" :key="category._id">
      <div style="width: 90%" class="fieldValue fieldValueContainer">
        <v-text-field dense v-model="category.name" />
      </div>
      <v-btn icon @click="remove(category)">
        <font-awesome-icon :icon="['fal', 'trash']" size="1x" />
      </v-btn>
    </div>

    <div class="option-item d-flex flex-row">
      <div style="width: 90%" class="fieldValue fieldValueContainer">
        <v-text-field dense v-model="newCategory" />
      </div>
      <v-btn icon @click="add">
        <font-awesome-icon :icon="['fal', 'plus']" size="1x" />
      </v-btn>
    </div>
  </div>
</template>
<script>

export default {

  props: {
    value: {
      type: Array
    }
  },

  data: () => ({
    newCategory: ""
  }),

  computed: {
    cssClasses: {
      get() {
        if (this.$vuetify.theme.dark) {
          return "slimForm slimFormDark";
        } else {
          return "slimForm slimFormLight";
        }
      }
    },
    categories: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },

  methods: {
    add() {
      const newCategory = this.newCategory.trim();

      if (newCategory.length === 0) {
        this.$store.commit("setError", "Please enter a name first");
        return;
      }

      for (const category of this.categories) {
        if (category.name === newCategory) {
          this.$store.commit("setError", "Category already exists");
          return;
        }
      }

      this.categories.push({
        _id: "#" + Math.random(),
        name: this.newCategory
      });
      this.newCategory = "";
    },

    remove(category) {
      this.categories.removeObject(category);
    }
  }

}

</script>
