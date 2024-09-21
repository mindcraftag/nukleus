<template>

  <div class="mb-4">
    <v-img :src="imageSource"
           width="100%"
           aspect-ratio="16/9"
           cover
    >
      <template v-slot:placeholder>
        <div class="d-flex align-center justify-center fill-height">
          <v-progress-circular
            color="grey-lighten-4"
            indeterminate
          ></v-progress-circular>
        </div>
      </template>
    </v-img>
  </div>

  <div class="text-h4 mb-2">
    {{item.name}}
  </div>

  <div class="mb-2">
    <ItemUserInfo :item="item" :small="true" />
  </div>

  <div class="mb-4">
    <TagsList :item="item" />
  </div>

  <div class="mb-4">
    {{item.description}}
  </div>
</template>
<script>

import { watch } from 'vue'
import ItemUserInfo from "./ItemUserInfo.vue";
import TagsList from './TagsList.vue'

export default {

  components: {
    ItemUserInfo,
    TagsList
  },

  props: {
    item: {
      type: Object,
      required: true
    },
    previewIndex: {
      type: Number,
      default: 1
    }
  },

  data: () => ({
    imageSource: null,
    loading: false
  }),

  mounted() {
    watch(() => [this.item], () => {
      this.loadImage();
    });
    this.loadImage();
  },

  methods: {
    async loadImage() {

      try {
        this.imageSource = null;
        this.loading = true;

        for (const attachment of this.item.attachments) {
          if (attachment.name === "preview" && attachment.index === this.previewIndex) {
            this.imageSource = await this.$store.state.nkclient.previewCache.get(this.item._id, this.previewIndex);
          }
        }
      }
      catch(err) {
        console.error(err);
      }

      this.loading = false;
    }
  }
}

</script>
