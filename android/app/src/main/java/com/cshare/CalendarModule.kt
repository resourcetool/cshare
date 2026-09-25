package com.cshare

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.util.TimeZone

/**
 * Puts CSHARE assignments into the phone's own calendar (CalendarContract).
 * If a Google account is set up on the phone, Android syncs those events to Google Calendar,
 * and the calendar app shows its own alerts, like Outlook does.
 * Runs entirely on the phone, so it works without internet.
 */
class CalendarModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CshareCalendar"

  private fun allowed(): Boolean =
      ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALENDAR) ==
          PackageManager.PERMISSION_GRANTED &&
          ContextCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_CALENDAR) ==
              PackageManager.PERMISSION_GRANTED

  @ReactMethod
  fun hasPermission(promise: Promise) {
    promise.resolve(allowed())
  }

  /** Calendars the person can add events to (their Google account calendar, "Phone", ...). */
  @ReactMethod
  fun listCalendars(promise: Promise) {
    if (!allowed()) {
      promise.reject("E_PERMISSION", "Calendar permission is not granted")
      return
    }
    try {
      val result = Arguments.createArray()
      val projection =
          arrayOf(
              CalendarContract.Calendars._ID,
              CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
              CalendarContract.Calendars.ACCOUNT_NAME,
              CalendarContract.Calendars.ACCOUNT_TYPE)
      val selection = "${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ?"
      val args = arrayOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR.toString())
      reactContext.contentResolver
          .query(CalendarContract.Calendars.CONTENT_URI, projection, selection, args, null)
          ?.use { cursor ->
            while (cursor.moveToNext()) {
              val item = Arguments.createMap()
              item.putDouble("id", cursor.getLong(0).toDouble())
              item.putString("name", cursor.getString(1) ?: "")
              item.putString("account", cursor.getString(2) ?: "")
              item.putString("type", cursor.getString(3) ?: "")
              result.pushMap(item)
            }
          }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("E_CALENDAR", e.message, e)
    }
  }

  /** Looks for an event we may have created earlier (protects against duplicates after a reinstall). */
  private fun findExisting(calendarId: Long, title: String, startMs: Long): Long {
    val projection = arrayOf(CalendarContract.Events._ID)
    val selection =
        "${CalendarContract.Events.CALENDAR_ID} = ? AND ${CalendarContract.Events.TITLE} = ? AND " +
            "${CalendarContract.Events.DTSTART} = ? AND ${CalendarContract.Events.DELETED} = 0"
    val args = arrayOf(calendarId.toString(), title, startMs.toString())
    reactContext.contentResolver
        .query(CalendarContract.Events.CONTENT_URI, projection, selection, args, null)
        ?.use { cursor -> if (cursor.moveToFirst()) return cursor.getLong(0) }
    return 0L
  }

  /** Adds the event, or updates it when [eventId] is known. Returns the event id. */
  @ReactMethod
  fun upsertEvent(
      calendarId: Double,
      eventId: Double,
      title: String,
      description: String,
      location: String,
      startMs: Double,
      endMs: Double,
      alarmMinutes: ReadableArray,
      promise: Promise
  ) {
    if (!allowed()) {
      promise.reject("E_PERMISSION", "Calendar permission is not granted")
      return
    }
    try {
      val resolver = reactContext.contentResolver
      val calId = calendarId.toLong()
      val start = startMs.toLong()
      var id = eventId.toLong()

      val values =
          ContentValues().apply {
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DESCRIPTION, description)
            put(CalendarContract.Events.EVENT_LOCATION, location)
            put(CalendarContract.Events.DTSTART, start)
            put(CalendarContract.Events.DTEND, endMs.toLong())
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
            put(CalendarContract.Events.HAS_ALARM, if (alarmMinutes.size() > 0) 1 else 0)
          }

      if (id <= 0L) id = findExisting(calId, title, start)

      var updated = 0
      if (id > 0L) {
        updated =
            resolver.update(
                ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id),
                values,
                null,
                null)
      }
      if (id <= 0L || updated == 0) {
        // new, or the person deleted it from their calendar: create it again
        values.put(CalendarContract.Events.CALENDAR_ID, calId)
        val uri = resolver.insert(CalendarContract.Events.CONTENT_URI, values)
        id = if (uri != null) ContentUris.parseId(uri) else 0L
      }
      if (id <= 0L) {
        promise.reject("E_CALENDAR", "The calendar did not accept the event")
        return
      }

      resolver.delete(
          CalendarContract.Reminders.CONTENT_URI,
          "${CalendarContract.Reminders.EVENT_ID} = ?",
          arrayOf(id.toString()))
      for (i in 0 until alarmMinutes.size()) {
        val reminder =
            ContentValues().apply {
              put(CalendarContract.Reminders.EVENT_ID, id)
              put(CalendarContract.Reminders.MINUTES, alarmMinutes.getInt(i))
              put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT)
            }
        resolver.insert(CalendarContract.Reminders.CONTENT_URI, reminder)
      }
      promise.resolve(id.toDouble())
    } catch (e: Exception) {
      promise.reject("E_CALENDAR", e.message, e)
    }
  }

  @ReactMethod
  fun deleteEvent(eventId: Double, promise: Promise) {
    if (!allowed()) {
      promise.reject("E_PERMISSION", "Calendar permission is not granted")
      return
    }
    try {
      reactContext.contentResolver.delete(
          ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId.toLong()), null, null)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_CALENDAR", e.message, e)
    }
  }
}
