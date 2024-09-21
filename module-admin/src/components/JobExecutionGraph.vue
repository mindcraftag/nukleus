<template>
  <canvas width="1024"
          height="24"
          style="width: 100%; height: 24px;"
          ref="canvas">

  </canvas>
</template>

<script>

import moment from 'moment';
import { eventBus } from '@mindcraftgmbh/nukleus-vueui';

export default {

  props: {
    jobs: {
      type: Array,
      required: true
    },
    startTime: {
      type: Object,
      required: true
    },
    endTime: {
      type: Object,
      required: true
    }
  },

  data: () => ({
    width: 0,
    height: 0
  }),

  computed: {
    timeRangeMs: {
      get() {
        return moment(this.endTime).diff(this.startTime, 'millisecond');
      }
    },
    timeRangeHours: {
      get() {
        return moment(this.endTime).diff(this.startTime, 'hours');
      }
    }
  },

  watch: {
    jobs: function(from, to) {
      this.render();
    }
  },

  methods: {
    timeToPixel(time) {
      const diff = moment(time).diff(this.startTime, 'millisecond');
      return Math.floor(diff / this.timeRangeMs * this.width);
    },
    jumpToNextMultipleOf(time, stepsMinutes) {
      const addMinutes = stepsMinutes - (time.minutes() % stepsMinutes);
      return time.clone().add(addMinutes, "minutes");
    },
    render() {
      if (!this.$refs.canvas)
        return;

      const ctx = this.$refs.canvas.getContext('2d');

      // Resize canvas buffer size to its actual element size
      // -------------------------------------------------------------------
      this.width = ctx.canvas.width  = this.$refs.canvas.clientWidth;
      this.height = ctx.canvas.height = this.$refs.canvas.clientHeight;

      // Define colors
      // -------------------------------------------------------------------
      let bgColor;
      let jobColor;
      let scaleColor;

      if (this.$vuetify.theme.dark) {
        bgColor = "#141414";
        scaleColor = "#505050";
        jobColor = "#a0c0e0";
      }
      else {
        bgColor = "#f0f0f0";
        scaleColor = "#d0d0d0";
        jobColor = "#204060";
      }

      // Clear the canvas
      // -------------------------------------------------------------------
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, this.width, this.height);

      // Draw the scale
      // -------------------------------------------------------------------
      let stepsMinutes;
      if (this.timeRangeHours <= 1) {
        stepsMinutes = 5;
      } else if (this.timeRangeHours < 4) {
        stepsMinutes = 15;
      } else {
        stepsMinutes = 60;
      }

      ctx.strokeStyle = scaleColor;
      ctx.fillStyle = scaleColor;
      ctx.font = "10px Arial";

      let step = this.jumpToNextMultipleOf(this.startTime, stepsMinutes);
      while(step.isBefore(this.endTime))
      {
        const offsetX = this.timeToPixel(step);
        ctx.moveTo(offsetX, 0);
        ctx.lineTo(offsetX, this.height-1);
        ctx.stroke();
        ctx.fillText(step.format("hh:mm"), offsetX + 1, 10);
        step.add(stepsMinutes, "minute");
      }

      // Draw jobs
      // -------------------------------------------------------------------
      for (const job of this.jobs) {

        switch(job.state) {
          case 0: // pending
            if (this.$vuetify.theme.dark)
              jobColor = "#a0c0e0";
            else
              jobColor = "#204060";
            break;

          case 1: // running
            if (this.$vuetify.theme.dark)
              jobColor = "#0000ff";
            else
              jobColor = "#000080";
            break;

          case 2: // failed
            if (this.$vuetify.theme.dark)
              jobColor = "#ff0000";
            else
              jobColor = "#800000";
            break;

          case 3: // succeeded
            if (this.$vuetify.theme.dark)
              jobColor = "#80ff80";
            else
              jobColor = "#00c000";
            break;
        }

        const startX = this.timeToPixel(job.startedAt);
        const stopX = this.timeToPixel(job.stoppedAt);

        let widthX = stopX - startX;
        if (widthX < 1)
          widthX = 1;

        ctx.fillStyle = jobColor;
        ctx.fillRect(startX, 0, widthX, this.height);
      }
    }
  },

  mounted() {
    const _this = this;

    this.render();

    window.addEventListener("resize", function() {
      _this.render();
    });

    eventBus.$on('darkModeUpdate', function() {
      _this.render();
    });
  }

}

</script>
