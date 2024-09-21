<template>
  <v-avatar color="#808080" :size="size">
    <div v-if="!image" :style="cssStyle">
      {{ initials }}
    </div>
    <img v-else :src="image" :alt="initials" />
  </v-avatar>
</template>
<script>

import { watch } from 'vue'

export default {
  props: {
    userId: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      default: 32,
    },
  },

  data: () => ({
    initials: "",
    image: null,
  }),

  computed: {
    fontSize() {
      return Math.floor(this.size / 2);
    },
    cssStyle() {
      return `font-size: ${this.fontSize}px;`;
    },
  },

  created() {
    const _this = this;

    this.load();

    this.$store.state.nkclient.eventBus.$on("nk:client:elementUpdate", (event) => {
      switch (event.type) {
        case "User":
          if (event.id === _this.userId) _this.load();
          break;
      }
    });

    watch(() => [this.userId], () => {
      this.load();
    });
  },

  methods: {
    async load() {
      try {
        const result = await this.$store.state.nkclient.getAvatar(
          this.userId,
          this.size,
        );
        this.initials = result.initials;
        this.image = result.avatar;
      } catch (err) {
        console.log(err);
      }
    },
  },
};
</script>
