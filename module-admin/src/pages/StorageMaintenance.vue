<template>
  <div>
    <h1 class="pageTitle">Storage Maintenance</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>
          <v-card width="100%">
            <v-row class="ma-4 mb-2" no-gutters>
              Last update:
              <span class="ml-2 font-weight-bold">
                {{ formatter.format(new Date(updatedAt)) }}
              </span>
            </v-row>

            <v-row no-gutters class="mx-2">
              <!-- Every bucket is a separate column so Vuetify can do an efficient layout regardless of screen size. -->
              <v-col class="pa-4 ma-2 bucket" v-for="bucket of buckets">
                <v-sheet>
                  <span class="text-h4">{{ bucket.name }}</span>
                  <v-row class="mt-0">
                    <v-col class="ma-4">
                      <v-row>
                        <span class="text-h6 text-decoration-underline">Additional</span>
                      </v-row>

                      <!-- Go over every key and just print it out. -->
                      <v-row v-for="key of bucket.additionalKeys">{{ key }}</v-row>

                      <!-- Show an empty state if there are no additional keys. -->
                      <v-row v-if="bucket.additionalKeys.length === 0" class="font-italic">None</v-row>
                    </v-col>

                    <v-col class="ma-4">
                      <v-row>
                        <span class="text-h6 text-decoration-underline">Missing</span>
                      </v-row>

                      <!-- Go over every item and output it's key, name and client -->
                      <v-row v-for="item of bucket.missingItems">
                        <v-col class="mb-2">
                          <v-row>{{ item.key }}</v-row>
                          <v-row class="ml-n1">Name: {{ item.name }}</v-row>
                          <v-row class="ml-n1">Client: {{ item.client }}</v-row>
                        </v-col>
                      </v-row>

                      <!-- Show an empty state if there are no missing items. -->
                      <v-row v-if="bucket.missingItems.length === 0" class="font-italic">None</v-row>
                    </v-col>
                  </v-row>
                </v-sheet>
              </v-col>
            </v-row>

            <v-row no-gutters justify="center" class="mt-2 mb-4">
              <v-btn color="red" class="white--text" @click="cleanFiles">
                <v-icon class="mr-3">mdi-delete</v-icon>
                Clean additional files from buckets
              </v-btn>
            </v-row>
          </v-card>
        </v-flex>
      </v-layout>
    </v-container>

    <!--
      This dialog is used to show the status of the request that cleans additional items.
      That request returns some data which is shown here.
    -->
    <v-dialog v-model="dialogOpen" width="500">
      <v-card>
        <v-card-title class="text-h4">
          Status
        </v-card-title>

        <!-- Show a loading circle while the request isn't complete yet. -->
        <v-card-text v-if="cleanRequest === null">
          <v-row justify="center">
            <v-progress-circular indeterminate></v-progress-circular>
          </v-row>
          <v-row justify="center">
            <span class="text-h6 black--text mt-4">Loading</span>
          </v-row>
        </v-card-text>

        <!-- Otherwise just output the json from the response. -->
        <v-card-text v-else>
          {{ JSON.stringify(cleanRequest, null, 4) }}
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="dialogOpen = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>

    </v-dialog>
  </div>
</template>

<script>

export default {
  data: () => ({
    // This formatter is used to format the updatedAt datetime.
    formatter: new Intl.DateTimeFormat(navigator.languages, {
      dateStyle: "medium",
      timeStyle: "medium",
    }),
    updatedAt: null,
    buckets: [],
    dialogOpen: false,
    cleanRequest: null,
  }),
  methods: {
    async cleanFiles() {
      this.cleanRequest = null;
      this.dialogOpen = true;
      const data = await this.$store.state.nkclient.command({ command: "cleanAdditionalFilesFromBuckets" })
      this.cleanRequest = data;
    }
  },
  async mounted() {
    const res = await this.$store.state.nkclient.command({ command: "getDataConsistencyReport" })
    this.updatedAt = res.updatedAt;
    this.buckets = res.value;
  }
}

</script>

<style scoped>
.bucket {
  border: 2px solid rgba(218, 218, 218, 0.39);
  border-radius: 8px;
}
</style>
