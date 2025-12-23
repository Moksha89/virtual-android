package com.virtualandroid.sms.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

interface SmsApiService {

    @POST("sms/upload")
    suspend fun uploadMessages(
        @Header("Authorization") apiKey: String,
        @Body request: SyncRequest
    ): Response<SyncResponse>

    @GET("sms/sync")
    suspend fun getMessages(
        @Header("Authorization") apiKey: String,
        @Query("device_id") deviceId: String,
        @Query("since") since: Long? = null
    ): Response<List<SyncMessage>>

    @DELETE("sms/purge")
    suspend fun purgeMessages(
        @Header("Authorization") apiKey: String,
        @Query("device_id") deviceId: String
    ): Response<SyncResponse>
}
