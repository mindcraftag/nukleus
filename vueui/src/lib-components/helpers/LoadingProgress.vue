<template>
  <div class="progressDiv">
    <div v-if="showIndicator">
      <svg
        id="Layer_1"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px"
        y="0px"
        width="24px"
        height="24px"
        viewBox="0 0 24 24"
        style="enable-background: new 0 0 50 50"
        xml:space="preserve"
      >
        <rect x="0" y="0" width="4" height="7" fill="#fff">
          <animateTransform
            attributeType="xml"
            attributeName="transform"
            type="scale"
            values="1,1; 1,3; 1,1"
            begin="0s"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </rect>
        <rect x="10" y="0" width="4" height="7" fill="#fff">
          <animateTransform
            attributeType="xml"
            attributeName="transform"
            type="scale"
            values="1,1; 1,3; 1,1"
            begin="0.2s"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </rect>
        <rect x="20" y="0" width="4" height="7" fill="#fff">
          <animateTransform
            attributeType="xml"
            attributeName="transform"
            type="scale"
            values="1,1; 1,3; 1,1"
            begin="0.4s"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    </div>
    {{ text }}
    <v-progress-linear :model-value="progressValue" height="8" />
  </div>
</template>

<style>
.progressDiv {
  color: white;
  background-color: black;
  position: absolute;
  padding: 10px;
  border: 1px solid #404040;
  border-radius: 5px;
  top: 50%;
  left: 50%;
  width: 300px;
  height: 80px;
  margin-top: -25px;
  margin-left: -150px;
  text-align: center;
}
</style>

<script>
export default {
  props: {
    value: {
      type: Number,
      required: false,
      default: 0,
    },
    showIndicator: {
      type: Boolean,
      required: false,
      default: false,
    },
    text: {
      type: String,
      required: false,
      default: 'Loading...',
    },
    loadingManager: {
      type: Object,
      required: false,
    },
  },

  computed: {
    progressValue() {
      if (!this.loadingManager) {
        return this.value
      }

      return this.loadingManager.getProgressPercent()
    },
  },
}
</script>
