<template>
  <v-container v-if="params.length" fluid class="paramEditor">
    <v-row v-for="param in params" :key="param.name" no-gutters>
      <v-col :cols="4">
        <div class="paramName">{{ param.name }}:</div>
      </v-col>
      <v-col :cols="8">
        <SmallTextField
          v-if="param.type === 'String'"
          v-model="param.value"
          @update:model-value="updateValues"
        ></SmallTextField>
        <SmallTextField
          v-if="
            param.type === 'Number' && (param.min == null || param.max == null)
          "
          v-model="param.value"
          mask="#####"
          @update:model-value="updateValues"
        ></SmallTextField>
        <v-slider
          v-if="
            param.type === 'Number' && param.min != null && param.max != null
          "
          v-model="param.value"
          :min="param.min"
          :max="param.max"
          thumb-label="always"
          :thumb-size="24"
          @update:model-value="updateValues"
        ></v-slider>
        <SmallCheckbox
          v-if="param.type === 'Boolean'"
          v-model="param.value"
          @update:model-value="updateValues"
        ></SmallCheckbox>
        <SmallSelect
          v-if="param.type === 'Enum'"
          v-model="param.value"
          :items="param.options"
          required
          @update:model-value="updateValues"
        ></SmallSelect>
        <SmallSelect
          v-if="param.type === 'Folder'"
          v-model="param.value"
          :items="param.items"
          return-object
          item-title="name"
          item-key="_id"
          append-icon="mdi-file-search"
          @update:model-value="updateValues"
          @click:append="showFolderPicker(param, false)"
        />
        <SmallSelect
          v-if="param.type === 'Folders'"
          v-model="param.value"
          :items="param.items"
          return-object
          item-title="name"
          item-key="_id"
          append-icon="mdi-file-search"
          @update:model-value="updateValues"
          @click:append="showFolderPicker(param, true)"
        />
        <SmallSelect
          v-if="param.type === 'DatatypeList'"
          v-model="param.value"
          :items="datatypes"
          item-title="name"
          item-key="_id"
          return-object
          multiple
          @update:model-value="updateValues"
        ></SmallSelect>
      </v-col>
    </v-row>

    <FolderPickerDialog
      v-model="showFolderPickerDialog"
      :multiselect="folderMultiselect"
      :folder-id="currentFolderId"
      @folder-picked="folderPicked"
    />
  </v-container>
</template>
<style>
.paramEditor .v-input {
  margin-top: 0;
  padding-top: 0;
  height: 40px;
  font-size: 12px;
}

.paramEditor .paramName {
  margin-top: 4px;
}

.paramEditor .v-selec__slot {
  height: 32px !important;
}

.paramEditor .v-input__slot {
  padding: 0;
  margin: 0;
  height: 24px;
}

.paramEditor .v-input__append-outer {
  padding: 0;
  margin: 0;
  height: 24px;
}

.paramEditor .v-input__control {
  height: 24px;
}

.paramEditor .v-select__selections {
  height: 24px;
  overflow: hidden;
}

.paramEditor .v-select__selection--comma {
  margin-top: 0;
  margin-bottom: 0;
}

.paramEditor .v-chip {
  font-size: 12px;
  height: 24px;
}
</style>
<script>

import FolderPickerDialog from '../pickers/FolderPickerDialog.vue'
import {watch} from "vue";
import SmallTextField from "../wrappers/SmallTextField.vue";
import SmallCheckbox from "../wrappers/SmallCheckbox.vue";
import SmallSelect from "../wrappers/SmallSelect.vue";

export default {
  components: {
    SmallSelect,
    SmallCheckbox,
    SmallTextField,
    FolderPickerDialog,
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    parameters: {
      type: Array,
      default: [],
    },
    currentFolderId: {
      type: String,
      default: null,
    },
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['changed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    showFolderPickerDialog: false,
    folderPickTarget: null,
    datatypes: [],
    currentFolder: null,
    folderMultiselect: false,
    params: [],
  }),

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  async created() {
    watch(() => [this.parameters], () => {
      this.initParams()
    });

    watch(() => [this.currentFolderId], () => {
      this.updateCurrentFolder()
    });

    this.datatypes = await this.$store.state.nkclient.getDatatypesList()
    await this.updateCurrentFolder()
    this.initParams()
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    initParams() {
      let result = []

      for (const param of this.parameters) {
        let value = param.default
        let items = []

        switch (param.type) {
          case 'Folder':
            if (this.currentFolder) {
              value = this.currentFolder
              items.push(this.currentFolder)
            }
            break

          default:
            break
        }

        result.push({
          value: value,
          type: param.type,
          name: param.name,
          min: param.min,
          max: param.max,
          options: param.options,
          items: items,
        })
      }

      this.params = result
      this.updateValues()
    },
    async updateCurrentFolder() {
      try {
        if (this.currentFolderId)
          this.currentFolder = await this.$store.state.nkclient.getFolder(
            this.currentFolderId
          )
        else this.currentFolder = null
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },
    showFolderPicker(param, multiselect) {
      this.folderPickTarget = param
      this.showFolderPickerDialog = true
      this.folderMultiselect = multiselect;
    },
    folderPicked(items) {
      if (this.folderMultiselect) {
        this.folderPickTarget.value = items

        if (this.folderPickTarget.items) {
          for (const i of items) {
            this.folderPickTarget.items.push(i)
          }
        } else this.folderPickTarget.items = [...items]
      } else {
        const item = items[0]
        this.folderPickTarget.value = item

        if (this.folderPickTarget.items) this.folderPickTarget.items.push(item)
        else this.folderPickTarget.items = [item]
      }

      this.updateValues()
    },
    updateValues() {
      let values = []

      for (const param of this.params) {
        switch (param.type) {
          case 'Folder':
            values.push({
              value: param.value ? param.value._id : null,
              name: param.name,
            })
            break
          case 'Folders':
            values.push({
              value: param.value ? param.value.map(i => i._id).join(",") : " ",
              name: param.name,
            })
            break
          case 'DatatypeList':
            values.push({
              value: Array.isArray(param.value)
                ? param.value.reduce((total, curr) => {
                    return total ? total + ';' + curr.name : curr.name
                  }, '')
                : null,
              name: param.name,
            })
            break
          default:
            values.push({
              value: param.value,
              name: param.name,
            })
            break
        }
      }

      this.$emit('changed', values)
    },
  },
}
</script>
