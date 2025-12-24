package com.virtualandroid.sms.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

interface SmsApiService {

    @POST("api/register")
    suspend fun registerDevice(
        @Body request: RegisterRequest
    ): Response<RegisterResponse>

    @POST("api/sync")
    suspend fun uploadMessages(
        @Header("Authorization") token: String,
        @Body request: SyncRequest
    ): Response<SyncResponse>

    @GET("api/messages")
    suspend fun getMessages(
        @Header("Authorization") token: String,
        @Query("device_id") deviceId: String,
        @Query("since") since: Long? = null
    ): Response<List<SyncMessage>>

    @DELETE("api/purge")
    suspend fun purgeMessages(
        @Header("Authorization") token: String,
        @Query("device_id") deviceId: String
    ): Response<SyncResponse>

    @POST("api/device/screen")
    suspend fun uploadScreenFrame(
        @Header("Authorization") token: String,
        @Body request: ScreenFrameRequest
    ): Response<SyncResponse>
}

data class ScreenFrameRequest(
    val frame_data: String
)

data class RegisterRequest(
    val device_id: String,
    val device_name: String,
    val invite_passkey: String
)

data class RegisterResponse(
    val success: Boolean,
    val device_token: String?,
    val message: String
)
