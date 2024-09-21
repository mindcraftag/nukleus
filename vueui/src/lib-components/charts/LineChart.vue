<script>

import { watch } from 'vue'
import { Line } from 'vue-chartjs'

export default {
  extends: Line,
  props: ['data', 'options'],
  mounted() {
    watch(() => [this.data], () => {
      this.render()
    });

    this.render()
  },
  methods: {
    render: function () {
      this.renderChart(this.data, this.options)
    },
  },
}
</script>
