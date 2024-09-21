<template>
  <v-container fluid grid-list-xl>
    <v-row wrap>
      <v-col d-flex lg12 sm12 xs12>
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <v-container fluid>
                  <v-row wrap>
                    <v-col xs12 sm6>
                      <v-select
                        v-model="attributeTemplate"
                        :items="attributeTemplates"
                        item-title="name"
                        return-object
                        density="compact"
                        label="Attribute Template"
                        clearable
                      />
                    </v-col>
                    <v-col xs12 sm6>
                      <v-btn color="primary" @click="sendQuery"
                        >Query</v-btn
                      >
                      <v-btn @click="exportAsExcel">Export as Excel</v-btn>
                    </v-col>
                  </v-row>
                </v-container>

                <br />

                <v-data-table
                  v-model="selected"
                  data-test="table"
                  item-key="_id"
                  show-select
                  return-object
                  density="compact"
                  :headers="headers"
                  :items="items"
                  :loading="loading"
                  loading-text="Loading..."
                  :items-per-page="100"
                  :sort-by="[{ key: 'name', order: 'desc'}]"
                  must-sort
                  :footer-props="{
                    itemsPerPageOptions: [100, 200, 500],
                  }"
                >
                  <template #item="props">
                    <tr data-test="itemListRow" :data-text="props.item.value.name">
                      <td></td>
                      <td>
                        {{ props.item.value.name }}
                      </td>
                      <td>
                        {{ props.item.value.type }}
                      </td>
                      <td v-for="field in fields" :key="field.name">
                        <span
                          v-if="
                            field.type === 'Attribute' &&
                            field.datatype === 'Boolean'
                          "
                        >
                          <v-checkbox
                            v-model="props.item.value.userAttributes[field.name]"
                            readonly
                          />
                        </span>
                        <span
                          v-else-if="
                            field.type === 'Attribute' &&
                            field.datatype === 'MultiEnum'
                          "
                        >
                          {{ props.item.value.userAttributes[field.name].join(", ") }}
                        </span>
                        <span
                          v-else-if="
                            field.type === 'Attribute' &&
                            field.datatype === 'StringMap'
                          "
                        >
                          <ul>
                            <li
                              v-for="(value, key) in props.item.value.userAttributes[
                                field.name
                              ]"
                              :key="key"
                            >
                              {{ key }}: {{ value }}
                            </li>
                          </ul>
                        </span>
                        <span
                          v-else-if="
                            field.type === 'Attribute' &&
                            field.datatype === 'Color'
                          "
                        >
                          <div
                            class="colorBox"
                            :style="
                              getColorStyle(
                                props.item.value.userAttributes[field.name],
                              )
                            "
                          ></div>
                          {{ props.item.value.userAttributes[field.name].r }} /
                          {{ props.item.value.userAttributes[field.name].g }} /
                          {{ props.item.value.userAttributes[field.name].b }}
                        </span>
                        <span v-else>
                          {{ props.item.value.userAttributes[field.name] }}
                        </span>
                      </td>
                    </tr>
                  </template>
                </v-data-table>
              </v-col>
            </v-row>
          </v-container>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
<script>
export default {
  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data() {
    return {
      attributeTemplate: null,
      attributeTemplates: [],
      headers: [],
      fields: [],
      selected: [],
      items: [],
      loading: false,
    };
  },

  created() {
    this.loadAttributeTemplates();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    getColorStyle(color) {
      return `background-color: rgb(${color.r}, ${color.g}, ${color.b})`;
    },

    async exportAsExcel() {
      try {
        this.loading = true;

        if (!this.attributeTemplate || !this.attributeTemplate.name) {
          this.$store.commit(
            "setError",
            "Please select an attribute template first.",
          );
          return;
        }

        const result = await this.$store.state.nkclient.queryItemsListAsExcel({
          userAttributeTemplate: this.attributeTemplate.name,
          withUserAttributes: true,
          withAttributes: true,
        });

        if (result.blob) {
          const url = window.URL.createObjectURL(result.blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", "export.xlsx");
          document.body.appendChild(link);
          link.click();
        } else {
          console.error("No blob returned from excel export", result);
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }

      this.loading = false;
    },

    async sendQuery() {
      try {
        this.loading = true;

        if (!this.attributeTemplate || !this.attributeTemplate.name) {
          this.$store.commit(
            "setError",
            "Please select an attribute template first.",
          );
          return;
        }

        const items = await this.$store.state.nkclient.queryItemsList({
          userAttributeTemplate: this.attributeTemplate.name,
          withUserAttributes: true,
          withAttributes: true,
        });

        const headers = [
          {
            title: "Name",
            key: "name",
            sortable: true,
          },
          {
            title: "Type",
            key: "type",
            sortable: true,
          },
        ];

        for (const field of this.attributeTemplate.fields) {
          headers.push({
            title: field.displayName || field.name,
            key: field.name,
            sortable: false,
          });
        }

        this.headers = headers;
        this.items = items;
        this.fields = this.attributeTemplate.fields;
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }

      this.loading = false;
    },

    async loadAttributeTemplates() {
      try {
        this.attributeTemplates =
          await this.$store.state.nkclient.getAttributeTemplates();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>
<style>
.colorBox {
  width: 16px;
  height: 16px;
  float: left;
}
</style>

<style></style>
