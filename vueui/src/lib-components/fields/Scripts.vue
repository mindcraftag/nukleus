<template>
  <div>
    <div v-for="(script, index) in scripts" :key="script._id">
      <Script
        :script="script"
        :allow-edit="allowEdit"
        :studio-mode="studioMode"
        :item-repo="itemRepo"
        :node-name-resolver="nodeNameResolver"
        :project-folder-id="projectFolderId"
        @remove="removeScript(index)"
      >
      </Script>
    </div>

    <div class="fieldListButtons">
      <v-btn size="x-small" class="bg-main" @click="addScript(null)"> Add script </v-btn>
    </div>
  </div>
</template>
<script>

import Script from './Script.vue'
import { isNumber } from 'lodash'
import { watch } from 'vue'

export default {

  name: "Scripts",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    Script,
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    block: {
      type: Object,
      required: true,
    },
    allowEdit: {
      type: Boolean,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
    itemRepo: {
      type: Object,
      required: true,
    },
    nodeNameResolver: {
      type: Function,
      required: true
    },
    projectFolderId: {
      type: String,
      required: true
    }
  },

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    scripts: []
  }),

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    blockId() {
      return this.block.id
    },
  },

  // ---------------------------------------------------------
  //  MOUNTED
  // ---------------------------------------------------------
  mounted() {
    watch(() => [this.block], () => {
        this.refreshScripts();
    });
    this.refreshScripts();
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    refreshScripts() {
      const newScripts = [];
      for (const script of this.block.scripts) {
        newScripts.push(script);
      }
      this.scripts = newScripts;
    },

    addScript(index) {
      index = index || this.scripts.length
      this.itemRepo.createNewScript(this.block, index)
      this.refreshScripts()
    },

    removeScript(index) {
      index = isNumber(index) ? index : this.scripts.length - 1
      this.itemRepo.removeScript(this.scripts[index], this.block)
      this.refreshScripts()
    },
  },
}
</script>
