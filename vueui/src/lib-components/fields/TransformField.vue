<template>
  <div>
    <div class="d-flex">
      <div>
        <v-btn class="bg-main" size="x-small" @click="toggleTransform">
          <font-awesome-icon :icon="transformExpanded ? ['fal', 'chevron-up'] : ['fal', 'chevron-down']"/>
        </v-btn>
      </div>
      <div v-if="!positionString && !rotationString && !scaleString" class="transform-ro" @click="toggleTransform">
        No transform
      </div>
      <div v-if="positionString" class="transform-ro" @click="toggleTransform">
        <span class="transform-label">P:</span> {{positionString}}
      </div>
      <div v-if="rotationString" class="transform-ro" @click="toggleTransform">
        <span class="transform-label">R:</span> {{rotationString}}
      </div>
      <div v-if="scaleString" class="transform-ro" @click="toggleTransform">
        <span class="transform-label">S:</span> {{scaleString}}
      </div>
      <div v-if="(positionString || rotationString || scaleString) && allowEdit" class="transform-ro" >
        <v-btn class="bg-main" size="x-small" @click="resetTransform">
          <font-awesome-icon :icon="['fal', 'rotate-left']"/>
        </v-btn>
      </div>
    </div>
    <v-expand-transition>
      <div v-if="transformExpanded">
        <div class="d-flex">
          <Vector3DField
            v-model="computedPosition"
            :allow-edit="allowEdit"
            :labels="['Position X', 'Y', 'Z']"
          />
        </div>
        <div class="d-flex">
          <QuatEulerField
            v-model="computedRotation"
            :allow-edit="allowEdit"
            :labels="['Rotation X', 'Y', 'Z']"
          />
        </div>
        <div class="d-flex">
          <Vector3DField
            v-model="computedScale"
            :allow-edit="allowEdit"
            :labels="['Scale X', 'Y', 'Z']"
          />
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>
<style>

.transform-ro {
  padding: 4px;
  height: 22px;
  margin-left: 8px;
  background-color: var(--color-dark-main-darker1);
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
}

.transform-label {
  font-weight: bold;
}

</style>
<script>
import Vector3DField from './Vector3DField.vue'
import QuatEulerField from './QuatEulerField.vue'

export default {

  name: "TransformField",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    Vector3DField,
    QuatEulerField,
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
    },
    allowEdit: {
      type: Boolean,
    },
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    transformExpanded: false
  }),

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    positionString: {
      get() {
        const v = this.computedPosition;
        const x = this.round(v.x);
        const y = this.round(v.y);
        const z = this.round(v.z);

        if (x === 0 && y === 0 && z === 0)
          return '';
        else
          return `${x} / ${y} / ${z}`;
      }
    },
    rotationString: {
      get() {
        const v = this.computedRotation;
        const x = this.round(v.x);
        const y = this.round(v.y);
        const z = this.round(v.z);

        if (x === 0 && y === 0 && z === 0)
          return '';
        else
          return `${x} / ${y} / ${z}`;
      }
    },
    scaleString: {
      get() {
        const v = this.computedScale;
        const x = this.round(v.x);
        const y = this.round(v.y);
        const z = this.round(v.z);

        if (x === 1 && y === 1 && z === 1)
          return '';
        else
          return `${x} / ${y} / ${z}`;
      }
    },
    computedPosition: {
      get() {
        return this.modelValue.position
      },
      set(value) {
        //console.log("Set new Transform.Position value: " + value);
        this.$emit('update:modelValue', {
          position: value,
          rotation: this.modelValue.rotation,
          scale: this.modelValue.scale,
        })
        this.$emit('changed')
      },
    },
    computedRotation: {
      get() {
        return this.modelValue.rotation
      },
      set(value) {
        //console.log("Set new Transform.Rotation value: " + value);
        this.$emit('update:modelValue', {
          position: this.modelValue.position,
          rotation: value,
          scale: this.modelValue.scale,
        })
        this.$emit('changed')
      },
    },
    computedScale: {
      get() {
        return this.modelValue.scale
      },
      set(value) {
        //console.log("Set new Transform.Scale value: " + value);
        this.$emit('update:modelValue', {
          position: this.modelValue.position,
          rotation: this.modelValue.rotation,
          scale: value,
        })
        this.$emit('changed')
      },
    },
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    round(v) {
      return Math.round(v*100) / 100;
    },
    toggleTransform() {
      this.transformExpanded = !this.transformExpanded;
    },
    resetTransform() {
      this.$emit('update:modelValue', {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });
      this.$emit('changed');
    }
  }
}
</script>
