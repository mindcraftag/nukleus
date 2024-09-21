<template>
  <div style="height: 100%">
    <div class="n-toolbarContainer">
      <v-toolbar density="compact" class="studioToolbar">

        <v-btn density="compact" variant="text" @click="clearLog">
          <font-awesome-icon :icon="['fal', 'trash']" color="#ffffff"/>&nbsp;
          Clear
        </v-btn>

        <v-spacer></v-spacer>
      </v-toolbar>
    </div>
    <div ref="refContainer" class="n-belowToolbarContainer">
    </div>
    <div ref="logContainer" class="logOverlay" :style="logComputedStyle">
      <DynamicScroller
        :items="log"
        :min-item-size="18"
        ref="scroller"
        class="scroller"
      >
        <template #default="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :data-index="index"
          >
          <div :class="['logViewerEntry', item.cssClass]">
            <span class="logViewerDate">{{ formatDate(item.date) }}</span>
            <span class="logViewerType">{{ item.type }}</span>
            <span>{{ formatMessage(item.message) }}</span>
          </div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
    </div>
  </div>
</template>

<style>
.scroller {
  height: 100%;
}

.logViewerEntry {
  display: flex;
  gap: 4px;
}

.logViewer_warning {
  color: yellow;
}

.logViewer_debug {
  color: cyan;
}

.logViewer_error {
  color: red;
}

.logViewerType {
  font-weight: bold;
  min-width: 50px;
}

.logViewerDate {
  color: #808080;
  min-width: 60px;
}

.logOverlay {
  background-color: var(--color-dark-main-highlight1) !important;
  font-family: var(--font-family-console);
  z-index: 90;
  color: white;
  position: absolute;
  padding: 10px;
  overflow: auto;
  opacity: var(--log-opacity);
}

.logOverlayHoverPos {
  z-index: 110 !important;
  left: 0;
  right: 0;
  width: 70%;
  height: 20%;
  bottom: 10px;
  margin-left: auto;
  margin-right: auto;
}

.logOverlay:hover {
  opacity: var(--log-opacity-hover);
}

.logOverlay ::-webkit-scrollbar {
  width: 12px;
}

.logOverlay ::-webkit-scrollbar-track {
  background: var(--color-dark-main);
  border-left: 1px solid #2c2c2c;
}

.logOverlay ::-webkit-scrollbar-thumb {
  background: #3e3e3e;
  border: solid 3px var(--color-dark-main);
  border-radius: 7px;
}

.logOverlay ::-webkit-scrollbar-thumb:hover {
  background: white;
}

.logOverlay ::-webkit-scrollbar-corner {
  background: var(--color-dark-main);
}

</style>

<script>

import moment from 'moment'
import { watch } from 'vue';
import uitools from "../../js-modules/uitools";
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

export default {
  components: {DynamicScroller, DynamicScrollerItem},
  props: {
    showErrorOverlay: {
      type: Boolean,
      default: false
    },
    opacity: {
      type: Number,
      default: 0.4
    },
    opacityHover: {
      type: Number,
      default: 1.0
    }
  },

  data: () => ({
    log: [],
    cancelObserve: null,
    logRect: null,

    isOverlay: false,

    overlayInterval: null,
    overlayDisplay: 'none',
    overlayOpacity: 0.0
  }),

  computed: {
    logComputedStyle() {
      if (this.isOverlay || !this.logRect)
        return `opacity: ${this.overlayOpacity}; display: ${this.overlayDisplay}`;
      else
        return `left: ${this.logRect.left}px; top: ${this.logRect.top}px; width: ${this.logRect.width}px; height: ${this.logRect.height}px`;
    }
  },

  created() {
    const _this = this

    this.$store.state.nkclient.eventBus.$on('nk:logger:add', function (log) {
      _this.addLog(log)
    });

    this.$store.state.nkclient.eventBus.$on('nk:logger:clear', function () {
      _this.clearLog()
    });
  },

  mounted() {
    watch(() => [this.opacity, this.opacityHover], () => {
      this.updateOpacities();
    });

    const refEl = this.$refs.refContainer;
    this.onResize(refEl);
    this.cancelObserve = uitools.observeResize(refEl, (el) => { this.onResize(el); });

    this.updateOpacities();
    this.createOverlay();
  },

  beforeUnmount() {
    if (this.cancelObserve) {
      this.cancelObserve();
      this.cancelObserve = null;
    }
  },

  methods: {

    onResize(el) {
      this.logRect = el.getBoundingClientRect();

      if (this.logRect.width === 0 || this.logRect.height === 0) {
        if (this.showErrorOverlay && !this.isOverlay) {
          this.$refs.logContainer.classList.add('logOverlayHoverPos');
          this.isOverlay = true;
        }
      } else {
        if (this.isOverlay) {
          this.$refs.logContainer.classList.remove('logOverlayHoverPos');
          this.isOverlay = false;
        }
      }
    },

    updateOpacities() {
      document.documentElement.style.setProperty('--log-opacity', this.opacity.toString());
      document.documentElement.style.setProperty('--log-opacity-hover', this.opacityHover.toString());
    },

    createOverlay() {
      const appEl = document.querySelector(".v-application");
      if(!appEl) {
        console.error("Cannot mount the log overlay because application div not found!");
        return;
      }

      const logContainer = this.$refs.logContainer;
      appEl.appendChild(logContainer);
    },

    checkOverlay() {
      this.overlayOpacity = 10.0;
      this.overlayDisplay = 'block';

      if (!this.overlayInterval) {
        this.overlayInterval = setInterval(() => {
          this.overlayOpacity -= 0.1;

          if (this.overlayOpacity <= 0) {
            clearInterval(this.overlayInterval);
            this.overlayInterval = null;
            this.overlayDisplay = 'none';
          }
        }, 50);
      }
    },

    formatDate: function (value) {
      return moment(value).format('hh:mm:ss')
    },

    formatMessage: function (value) {
      try {
        return value.toString()
      } catch (err) {
        return '<cannot serialize>: ' + err
      }
    },

    clearLog() {
      this.log = []
    },

    addLog(log) {
      try {

        if (log.type === 'error')
          this.checkOverlay();

        log.cssClass = `logViewer_${log.type}`
        log.id = this.log.length

        this.log.push(log)
        
        setTimeout(() => this.scrollDown(), 100)
      } catch (err) {
        console.originalError ? console.originalError(err) : console.error(err);
      }
    },
    scrollDown() {
      if (!this.$refs.scroller) return;

      this.$refs.scroller.scrollToBottom();
    },
  },
}
</script>
