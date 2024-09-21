<template>
  <div class="d-flex">
    <div class="fieldValueContainer fieldValueContainerNoisePreview">
      <div class="imageContainer">
        <img :src="imageSrc" alt="Noise Texture Image" />
      </div>
    </div>
  </div>
</template>

<style>
.fieldValueContainerNoisePreview {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100% !important;
  height: 100% !important;
}

.imageContainer {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.imageContainer img {
  position: relative;
  max-width: 100%;
  height: auto;
  padding-top: 2%;
  padding-bottom: 2%;
  border-radius: 7%;
}
</style>

<script>

export default {
  name: "NoisePreviewField",

  props: {
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    itemRepo: {
      type: Object,
      required: true,
    }
  },

  data() {
    return {
      // We might want to have a default image as fallback if noise texture is not loaded
      imageSrc: "",
    };
  },

  computed: {
    id() {
      return this.itemRepo.editedItem._id;
    },
  },

  mounted() {
    this.$store.state.nkclient.eventBus.$on(
      `nk:particles:noiseTexData:${this.id}`,
      this.onImageUpdated
    );
    // Request noise texture when component is mounted
    this.$store.state.nkclient.eventBus.$emit(`nk:particles:requestNoiseTexture:${this.id}`);
  },

  beforeUnmount() {
    this.$store.state.nkclient.eventBus.$off(
      `nk:particles:noiseTexData:${this.id}`,
      this.onImageUpdated
    );
  },

  methods: {
    onImageUpdated(event) {
      if (event) {
        this.imageSrc = event;
      }
    },
  },
};
</script>
