package com.virtualandroid.sms.data

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private var retrofit: Retrofit? = null
    private var currentBaseUrl: String? = null

    fun getApiService(baseUrl: String): SmsApiService {
        if (retrofit == null || currentBaseUrl != baseUrl) {
            currentBaseUrl = baseUrl

            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val okHttpClient = OkHttpClient.Builder()
                .addInterceptor(loggingInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()

            val normalizedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"

            retrofit = Retrofit.Builder()
                .baseUrl(normalizedUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }

        return retrofit!!.create(SmsApiService::class.java)
    }

    fun clearClient() {
        retrofit = null
        currentBaseUrl = null
    }
}
