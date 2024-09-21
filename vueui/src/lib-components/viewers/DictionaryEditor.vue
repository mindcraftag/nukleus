<template>
  <div>
    <v-table
      v-if="attributesArray.length > 0 || allowEdit"
      density="compact"
      :class="cssClasses"
    >
      <template #default>
        <thead>
          <tr>
            <th class="text-left">Key</th>
            <th class="text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="attr in attributesArray" :key="attr.key">
            <td>{{ attr.key }}</td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-text-field
                  v-if="allowEdit"
                  v-model="attr.value"
                  density="compact"
                  append-icon="mdi-minus"
                  @change="valueChanged(attr.key, attr.value)"
                  @click:append="removeAttribute(attr.key)"
                />
                <v-text-field
                  v-else
                  v-model="attr.value"
                  :readonly="true"
                  density="compact"
                />
              </div>
            </td>
          </tr>
          <tr v-if="allowEdit">
            <td>
              <div class="fieldValueContainer">
                <v-text-field v-model="newKey" />
              </div>
            </td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-text-field
                  v-model="newValue"
                  append-icon="mdi-plus"
                  @click:append="addAttribute"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </template>
    </v-table>
  </div>
</template>

<style>
.attributeEditor td {
  border: 0 !important;
}

.attributeEditor .v-text-field {
  padding-top: 0;
  margin-top: 0;
  font-size: 14px;
}

.attributeEditor .fieldValueContainer {
  border-radius: 5px;
  margin-top: 2px;
  margin-bottom: 2px;
  height: 24px;
}

.attributeEditor .fieldValue {
  padding-right: 0;
}

.attributeEditor .v-input__slot:after {
  border: 0 !important;
  content: none !important;
}

.attributeEditor .v-input__slot:before {
  border: 0 !important;
  content: none !important;
}

.attributeEditor .v-input__slot {
  padding: 0;
  margin: 0;
  height: 24px;
}

.attributeEditor .v-input__append-outer {
  padding: 0;
  margin: 0;
  height: 24px;
}

.attributeEditor .v-input__control {
  height: 24px;
}

.attributeEditor .v-data-table td {
  height: 24px;
}

.attributeEditor td:first-child {
  width: 30%;
}

/*
  LIGHT MODE
 */

.attributeEditorLight .fieldValueContainer {
  background-color: #d6d6d6;
  border-top: 1px solid #d0d0d0;
  border-left: 1px solid #d0d0d0;
}

.attributeEditorLight .fieldValueContainer:hover {
  background-color: #dddddd;
}

/*
  DARK MODE
 */

.attributeEditorDark {
  background-color: #202020 !important;
}

.attributeEditorDark .fieldValueContainer {
  background-color: #181818;
  border: 1px solid #181818;
}

.attributeEditorDark .fieldValueContainer:hover {
  background-color: #1a1a1a;
  border: 1px solid #0080ff;
}

/*
  STUDIO MODE
 */

.attributeEditorStudio {
  background-color: #303030 !important;
}

.attributeEditorStudio .fieldValueContainer {
  background-color: #282828;
  border: 1px solid #282828;
}

.attributeEditorStudio .fieldValueContainer:hover {
  background-color: #2a2a2a;
  border: 1px solid #0080ff;
}
</style>

<script>
export default {
  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    value: {
      type: Object,
      required: true,
    },
    allowEdit: {
      type: Boolean,
      default: false,
    },
    itemRepo: {
      type: Object,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    newKey: null,
    newValue: null,
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    cssClasses: {
      get() {
        if (this.studioMode) {
          return 'attributeEditor attributeEditorStudio'
        } else if (this.$store.state.darkMode) {
          return 'attributeEditor attributeEditorDark'
        } else {
          return 'attributeEditor attributeEditorLight'
        }
      },
    },
    attributesArray: function () {
      const attr = []

      for (const key in this.value) {
        attr.push({ key: key, value: this.value[key] })
      }

      console.log(attr)

      return attr
    },
    computedValue: {
      get() {
        return this.value
      },
      set(value) {
        this.$emit('input', value)
      },
    },
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    valueChanged(key, value) {
      this.addOrUpdateAttribute(key, value, false)
    },

    existsKey(newKey) {
      for (const key in this.computedValue) {
        if (key === newKey) return true
      }
      return false
    },

    validKey(key) {
      return (
        !key.includes('.') &&
        !key.includes('->') &&
        !key.includes('[') &&
        !key.includes(']')
      )
    },

    validValue(value) {
      return value && value.trim().length > 0
    },

    addAttribute() {
      try {
        this.addOrUpdateAttribute(this.newKey, this.newValue, true)
        this.newKey = null
        this.newValue = null
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err)
      }
    },

    addOrUpdateAttribute(key, value, isNew) {
      if (!this.validValue(key)) {
        throw 'Key invalid'
      }

      if (!this.validValue(value)) {
        throw 'Value invalid'
      }

      if (isNew) {
        if (!this.validKey(key)) {
          throw 'Key is invalid. Must not contain . or -> or []'
        }

        if (this.existsKey(key)) {
          throw 'Key already exists'
        }
      }

      let newValue = JSON.parse(JSON.stringify(this.value))
      newValue[key] = value
      this.computedValue = newValue
    },

    removeAttribute(key) {
      let newValue = JSON.parse(JSON.stringify(this.value))
      delete newValue[key]
      this.computedValue = newValue
    },
  },
}
</script>
